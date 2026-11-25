// 研究紀錄：在背景記下學生在遊樂場的每一個「選擇」（學生看不到）
// 用來看：贏了／輸了以後會不會再選同一個遊戲、風險偏好、沉沒成本、延宕滿足
window.Research = (() => {
  'use strict';
  const LUCK = { 吃角子老虎機: 1, 刮刮樂: 1, 彈珠台: 1, 夾娃娃機: 1, 猜大小: 1, 小動物賽跑: 1 };
  const SKILL = { 打地鼠: 1, 翻牌記憶配對: 1 };
  const price = () => Number(W.data.settings.zone.price) || 10;
  const r1 = (x) => Math.round(x * 10) / 10;

  function R() {
    const d = W.data;
    if (!d.research || typeof d.research !== 'object') d.research = {};
    const r = d.research;
    if (!Array.isArray(r.log)) r.log = [];
    if (!r.last || typeof r.last !== 'object') r.last = {};
    if (!r.visit || typeof r.visit !== 'object') r.visit = {};
    return r;
  }
  const resultOf = (net) => (net > 0 ? '贏' : net < 0 ? '輸' : '平');
  const pad = (n) => String(n).padStart(2, '0');
  const dateOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  // 共用：寫一列
  function push(s, ev, game, f) {
    const r = R();
    const dt = new Date();
    const row = {
      t: dt.toISOString(), d: dateOf(dt), sid: s.id, name: s.name, cls: W.cls().name,
      ev, game: game || '', kind: game ? (LUCK[game] ? '機率' : SKILL[game] ? '技巧' : '') : '',
      visit: r.visit[s.id] || 0,
      score: s.score, tickets: s.zoneTickets || 0, ...(f || {})
    };
    r.log.push(row);
    return row;
  }

  // 進入／離開遊樂場（可以看出「進來看看但沒玩」）
  function enter(s) { const r = R(); r.visit[s.id] = (r.visit[s.id] || 0) + 1; push(s, '進入遊樂場', ''); W.save(); }
  function leave(s) { push(s, '離開遊樂場', ''); W.save(); }

  // 用點數換入場券（機會成本）
  function buy(s, cost, note) { push(s, '換入場券', '', { choice: '換 1 張', cost, note: note || '' }); }

  // 選遊戲：同時記下「上一次玩什麼、結果如何」
  function pick(s, game) {
    const last = R().last[s.id];
    push(s, '選遊戲', game, {
      prevGame: last ? last.game : '', prevResult: last ? last.result : '',
      same: last ? (last.game === game ? 1 : 0) : ''
    });
    W.save();
  }

  // 做決定：選項的機率、可以拿到的、成本、期望值（點數）
  // p：中獎機率 0～100；prize：中了拿幾點；cost：成本（點）
  function decide(s, game, choice, o) {
    o = o || {};
    const f = { choice, round: o.round ?? '', note: o.note || '' };
    if (o.sunk !== undefined) f.sunk = o.sunk;
    if (o.p !== undefined && o.p !== '') f.p = r1(o.p);
    if (o.prize !== undefined) f.prize = o.prize;
    if (o.cost !== undefined) f.cost = o.cost;
    if (o.ev !== undefined) f.evp = r1(o.ev);
    else if (o.p !== undefined && o.prize !== undefined && o.cost !== undefined) f.evp = r1(o.p / 100 * o.prize - o.cost);
    push(s, '決定', game, f);
  }

  // 結果：淨得＝拿到的點數－用掉的入場券價值
  function outcome(s, game, prize, tickets, note) {
    const net = prize - tickets * price();
    const res = resultOf(net);
    push(s, '結果', game, { prize, cost: tickets * price(), net, result: res, note: note || '' });
    R().last[s.id] = { game, result: res, net };
  }

  // 存錢機
  function saving(s, what, note) { push(s, what, '存錢機', { note: note || '' }); }

  // ---------- 匯出 CSV ----------
  const COLS = [
    ['t', '時間'], ['d', '日期'], ['cls', '班級'], ['name', '學生'], ['visit', '第幾次進遊樂場'],
    ['ev', '事件'], ['game', '遊戲'], ['kind', '機率／技巧'], ['choice', '選項'], ['round', '第幾次／第幾關'],
    ['sunk', '前面連續失敗次數'], ['p', '中獎機率%'], ['prize', '可得或拿到(點)'], ['cost', '成本(點)'], ['evp', '期望值(點)'],
    ['net', '淨得(點)'], ['result', '結果'], ['prevGame', '上一個遊戲'], ['prevResult', '上一次結果'],
    ['same', '跟上一次同遊戲'], ['score', '點數(事件後)'], ['tickets', '入場券(事件後)'], ['note', '備註']
  ];
  const cell = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const localTime = (iso) => { const d = new Date(iso); return `${dateOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  function csv(rows) {
    rows = rows || R().log;
    const head = COLS.map((c) => c[1]).join(',');
    const body = rows.map((r) => COLS.map(([k]) => cell(k === 't' ? localTime(r.t) : r[k])).join(',')).join('\r\n');
    return '﻿' + head + '\r\n' + body + '\r\n';
  }

  // ---------- 給老師看的摘要（每個學生一列） ----------
  function summary(rows) {
    rows = rows || R().log;
    const by = new Map();
    const S = (r) => {
      if (!by.has(r.sid)) by.set(r.sid, { name: r.name, visits: 0, noPlay: 0, picks: 0, luck: 0, buys: 0, ws: [0, 0], ls: [0, 0], slotBet: [], keep: 0, hiloCash: [], hiloBust: 0, raceP: [], clawFail: 0, clawAgain: 0, saved: 0, claimed: 0, early: 0, ev: [], played: false, lastOut: null });
      return by.get(r.sid);
    };
    rows.forEach((r) => {
      const x = S(r);
      if (r.ev === '進入遊樂場') { x.visits++; x.played = false; }
      else if (r.ev === '離開遊樂場') { if (!x.played) x.noPlay++; }
      else if (r.ev === '換入場券') x.buys++;
      else if (r.ev === '選遊戲') { x.picks++; if (r.kind === '機率') x.luck++; }
      else if (r.ev === '決定') {
        if (r.evp !== undefined && r.evp !== '' && r.choice !== '不拉' && r.choice !== '收手') x.ev.push(Number(r.evp));
        if (r.game === '吃角子老虎機') { if (r.choice === '不拉') x.keep++; else x.slotBet.push(Number(r.cost) / price()); }
        if (r.game === '小動物賽跑' && r.p !== undefined) x.raceP.push(Number(r.p));
        if (r.game === '猜大小' && r.choice === '收手') x.hiloCash.push(Number(r.round) || 0);
        if (r.game === '夾娃娃機' && Number(r.sunk) >= 1) x.clawAgain++;
        if (r.choice !== '不拉' && r.choice !== '收手' && r.game) x.played = true;
      } else if (r.ev === '結果') {
        // 贏了留下／輸了換掉：看「下一次玩的遊戲」跟這次一不一樣
        if (x.lastOut) {
          const same = x.lastOut.game === r.game;
          if (x.lastOut.result === '贏') { x.ws[1]++; if (same) x.ws[0]++; }
          if (x.lastOut.result === '輸') { x.ls[1]++; if (!same) x.ls[0]++; }
        }
        x.lastOut = { game: r.game, result: r.result };
        if (r.game === '猜大小' && Number(r.prize) === 0) x.hiloBust++;
        if (r.game === '夾娃娃機' && Number(r.prize) === 0) x.clawFail++;
      } else if (r.ev === '存入') x.saved++;
      else if (r.ev === '到期領回') x.claimed++;
      else if (r.ev === '提早領回') x.early++;
    });
    const pct = (a, b) => (b ? `${Math.round(a / b * 100)}%` : '—');
    const avg = (a) => (a.length ? r1(a.reduce((p, q) => p + q, 0) / a.length) : '—');
    return [...by.values()].map((x) => ({
      name: x.name,
      visits: x.visits, noPlay: x.noPlay, buys: x.buys, picks: x.picks,
      luck: pct(x.luck, x.picks),
      winStay: x.ws[1] ? `${pct(x.ws[0], x.ws[1])}（${x.ws[1]}）` : '—',
      loseShift: x.ls[1] ? `${pct(x.ls[0], x.ls[1])}（${x.ls[1]}）` : '—',
      slotBet: avg(x.slotBet), keep: x.keep,
      hiloCash: avg(x.hiloCash), hiloBust: x.hiloBust,
      raceP: x.raceP.length ? `${avg(x.raceP)}%` : '—',
      clawAgain: x.clawFail ? `${pct(x.clawAgain, x.clawFail)}` : '—',
      save: `${x.saved}／${x.claimed}／${x.early}`,
      ev: avg(x.ev)
    }));
  }

  function count() { return R().log.length; }
  function clear() { const r = R(); r.log = []; r.last = {}; r.visit = {}; }

  return { enter, leave, buy, pick, decide, outcome, saving, csv, summary, count, clear, rows: () => R().log };
})();
