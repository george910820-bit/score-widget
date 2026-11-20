// 虎尾大富翁（雛形）：上課好行為累積分數換擲骰機會，全班共用一張地圖
// 格子與機會／命運卡融入財商、法治、性平、環境教育
window.Monopoly = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- 地圖：一圈 24 格，從右下角的起點開始，順時針 ----------
  const TILES = [
    { t: 'start', icon: '🏁', name: '起點' },
    { t: 'prop', icon: '🏭', name: '虎尾糖廠', price: 60, rent: 10, color: '#e85d75' },
    { t: 'chance', icon: '❓', name: '機會' },
    { t: 'prop', icon: '🎭', name: '布袋戲館', price: 60, rent: 10, color: '#e85d75' },
    { t: 'shop', icon: '🛒', name: '商店' },
    { t: 'prop', icon: '🌉', name: '虎尾鐵橋', price: 70, rent: 12, color: '#f59e0b' },
    { t: 'bank', icon: '🏦', name: '銀行' },
    { t: 'prop', icon: '📚', name: '雲林故事館', price: 80, rent: 14, color: '#f59e0b' },
    { t: 'fate', icon: '🌀', name: '命運' },
    { t: 'prop', icon: '🏛️', name: '合同廳舍', price: 80, rent: 14, color: '#2e9d5b' },
    { t: 'eco', icon: '♻️', name: '環保站' },
    { t: 'prop', icon: '🌊', name: '虎尾溪堤防', price: 90, rent: 16, color: '#2e9d5b' },
    { t: 'court', icon: '⚖️', name: '法院' },
    { t: 'prop', icon: '📖', name: '虎尾圖書館', price: 100, rent: 18, color: '#3b82f6' },
    { t: 'chance', icon: '❓', name: '機會' },
    { t: 'prop', icon: '🏘️', name: '建國眷村', price: 100, rent: 18, color: '#3b82f6' },
    { t: 'friend', icon: '🤝', name: '友善小站' },
    { t: 'prop', icon: '🚄', name: '高鐵雲林站', price: 120, rent: 22, color: '#8b5cf6' },
    { t: 'lucky', icon: '🎁', name: '幸運抽獎' },
    { t: 'chance', icon: '❓', name: '機會' },
    { t: 'fate', icon: '🌀', name: '命運' },
    { t: 'insure', icon: '🛡️', name: '保險公司' },
    { t: 'eco', icon: '♻️', name: '環保站' },
    { t: 'fate', icon: '🌀', name: '命運' }
  ];
  // 第 i 格在 7×7 方格上的位置（列、行）
  function cellOf(i) {
    if (i <= 6) return [6, 6 - i];
    if (i <= 12) return [6 - (i - 6), 0];
    if (i <= 18) return [0, i - 12];
    return [i - 18, 6];
  }

  // ---------- 卡片：機會、命運，以及法院／環保站／友善小站的情境題 ----------
  const CARDS = [
    { deck: 'chance', topic: '財商', text: '你把零用錢存了 3 週。', kind: 'gain', amt: 15, why: '存錢會讓你在需要的時候有錢用。' },
    { deck: 'chance', topic: '財商', text: '同學約你一起買限量卡片（30 💰）。這是需要，還是想要？', kind: 'choice',
      options: [{ label: '買（−30 💰）', amt: -30, after: '你得到卡片，但少了 30 💰。' }, { label: '不買，先存著', amt: 0, after: '錢留著，可以用在更需要的地方。' }] },
    { deck: 'fate', topic: '財商', text: '腳踏車壞了，要修理。', kind: 'loss', amt: 20, insurable: true },
    { deck: 'fate', topic: '財商', text: '你向朋友借的錢按時還了，大家更相信你。', kind: 'gain', amt: 10, why: '按時還錢就是有「信用」。' },
    { deck: 'chance', topic: '法治', text: '你撿到一個錢包，你會怎麼做？', kind: 'quiz', reward: 20,
      options: [{ label: '交給老師或警察', ok: true }, { label: '自己留著', ok: false }], why: '撿到東西要還給主人，這是負責任的做法。' },
    { deck: 'chance', topic: '法治', text: '班上要訂掃地規則，你提出了一個大家都覺得公平的方法。', kind: 'gain', amt: 10, why: '一起參與訂規則，規則會更公平。' },
    { deck: 'fate', topic: '法治', text: '網路上的陌生人要你的照片，你會怎麼做？', kind: 'quiz', reward: 10,
      options: [{ label: '拒絕，並告訴大人', ok: true }, { label: '傳給他', ok: false }], why: '不給陌生人照片和個人資料，遇到了要告訴大人。' },
    { deck: 'chance', topic: '性平', text: '男生可以學跳舞、女生可以當工程師嗎？', kind: 'quiz', reward: 10,
      options: [{ label: '可以，大家都可以', ok: true }, { label: '不行', ok: false }], why: '喜歡什麼、做什麼工作，不應該被性別限制。' },
    { deck: 'fate', topic: '性平', text: '有人一直戳你，你覺得不舒服。你可以說什麼？', kind: 'quiz', reward: 10,
      options: [{ label: '「請停止，我不喜歡」', ok: true }, { label: '忍耐，不說話', ok: false }], why: '身體是自己的，不舒服可以說不。' },
    { deck: 'chance', topic: '性平', text: '遇到讓你害怕的事，可以找誰幫忙？', kind: 'quiz', reward: 10,
      options: [{ label: '老師、爸媽或信任的大人', ok: true }, { label: '誰都不要說', ok: false }], why: '遇到害怕的事要說出來，大人會幫你。' },
    { deck: 'chance', topic: '環境', text: '你把寶特瓶洗乾淨拿去回收。', kind: 'gain', amt: 10, why: '回收讓資源可以再利用。' },
    { deck: 'fate', topic: '環境', text: '出門忘記關冷氣，電費變多了。', kind: 'loss', amt: 15, why: '隨手關電，可以省錢也省能源。' },
    { deck: 'court', topic: '法治', text: '有人插隊被發現，大家說他要排到最後面。這樣公平嗎？', kind: 'quiz', reward: 10,
      options: [{ label: '公平，要遵守排隊規則', ok: true }, { label: '不公平', ok: false }], why: '規則是大家一起遵守的，違反規則要負責。' },
    { deck: 'court', topic: '法治', text: '玩遊戲前大家訂好規則，玩到一半有人輸了想改規則。可以嗎？', kind: 'quiz', reward: 10,
      options: [{ label: '不行，要照一開始的規則', ok: true }, { label: '可以，輸的人說了算', ok: false }], why: '規則大家同意後就要遵守；要改，也要大家一起討論。' },
    { deck: 'court', topic: '法治', text: '同學不小心打破你的水壺，他道歉並說要賠。你會怎麼做？', kind: 'quiz', reward: 10,
      options: [{ label: '接受道歉，一起想怎麼賠', ok: true }, { label: '也去打破他的東西', ok: false }], why: '弄壞別人的東西要負責；用報復解決問題是不對的。' },
    { deck: 'eco', topic: '環境', text: '吃完的便當盒（洗乾淨）要丟哪裡？', kind: 'quiz', reward: 10,
      options: [{ label: '回收', ok: true }, { label: '一般垃圾', ok: false }], why: '洗乾淨的便當盒可以回收再利用。' },
    { deck: 'eco', topic: '環境', text: '離開教室時，電燈和電扇要怎麼辦？', kind: 'quiz', reward: 10,
      options: [{ label: '隨手關掉', ok: true }, { label: '開著沒關係', ok: false }], why: '隨手關電可以節省能源。' },
    { deck: 'eco', topic: '環境', text: '用完的廢電池要丟哪裡？', kind: 'quiz', reward: 10,
      options: [{ label: '電池回收筒', ok: true }, { label: '一般垃圾桶', ok: false }], why: '電池裡有有害物質，要放到回收筒。' },
    { deck: 'friend', topic: '性平', text: '小美想參加籃球隊，有人說「女生不要打籃球」。你會怎麼說？', kind: 'quiz', reward: 10,
      options: [{ label: '女生也可以打籃球', ok: true }, { label: '對啊，籃球是男生的', ok: false }], why: '運動不分男生女生。' },
    { deck: 'friend', topic: '性平', text: '朋友想抱你，但你現在不想。你可以怎麼做？', kind: 'quiz', reward: 10,
      options: [{ label: '說「我現在不想被抱」', ok: true }, { label: '不敢說，只好讓他抱', ok: false }], why: '你可以決定別人能不能碰你的身體。' },
    { deck: 'friend', topic: '性平', text: '小華哭了，有人說「男生不可以哭」。你覺得呢？', kind: 'quiz', reward: 10,
      options: [{ label: '每個人都可以哭', ok: true }, { label: '男生不可以哭', ok: false }], why: '難過的時候哭是正常的，不分性別。' }
  ];
  const TOPIC_COLOR = { 財商: '#b26b00', 法治: '#3b5bdb', 性平: '#c2255c', 環境: '#2b8a3e' };

  // ---------- 資料 ----------
  const D = () => W.data;
  const M = () => D().settings.monopoly;
  const G = () => { const d = D(); if (!d.monopoly) d.monopoly = { owners: {} }; if (!d.monopoly.owners) d.monopoly.owners = {}; return d.monopoly; };
  function mp(s) {
    if (!s.mp) s.mp = {};
    const m = s.mp;
    if (typeof m.coins !== 'number') m.coins = Number(M().startCoins) || 100;
    ['pos', 'deposit', 'debt', 'rolls', 'progress'].forEach((k) => { if (typeof m[k] !== 'number') m[k] = 0; });
    if (typeof m.insured !== 'boolean') m.insured = false;
    return m;
  }
  const students = () => W.cls().students;
  const ownerOf = (i) => G().owners[i];
  const propsOf = (s) => Object.keys(G().owners).filter((k) => G().owners[k] === s.id).map(Number);
  const assets = (s) => { const m = mp(s); return m.coins + m.deposit + propsOf(s).reduce((a, i) => a + TILES[i].price, 0) - m.debt; };
  function log(s, text) {
    D().history.push({ t: new Date().toISOString(), type: 'mp', classId: W.cls().id, studentId: s.id, name: s.name, delta: 0, score: s.score, item: text });
  }

  // 加分時呼叫：每累積 perRoll 分，得到 1 次擲骰機會
  function onPoints(s, delta) {
    if (delta <= 0) return 0;
    const m = mp(s);
    const per = Math.max(1, Number(M().perRoll) || 5);
    m.progress += delta;
    let got = 0;
    while (m.progress >= per) { m.progress -= per; m.rolls++; got++; }
    return got;
  }

  // ---------- 畫面 ----------
  let cur = null; // { root, sel, busy }

  function open() {
    close();
    const root = document.createElement('div');
    root.className = 'mp-overlay';
    root.innerHTML = `
      <div class="lotto-top">
        <div class="mp-title">🏙️ 虎尾大富翁</div>
        <div class="mp-sub">好行為每 ${Math.max(1, Number(M().perRoll) || 5)} 分換 1 次 🎲</div>
        <span class="grow"></span>
        <button class="icon-btn lotto-x" id="mpClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="mp-body" id="mpBody">
        <div class="mp-board-wrap" id="mpWrap"><div class="mp-board" id="mpBoard"></div></div>
        <div class="mp-side" id="mpSide"></div>
      </div>`;
    document.body.appendChild(root);
    cur = { root, sel: null, busy: false };
    students().forEach(mp);
    const first = students().find((s) => mp(s).rolls > 0) || students()[0];
    cur.sel = first ? first.id : null;
    root.querySelector('#mpClose').onclick = () => { if (!cur.busy) close(); };
    renderBoard();
    renderSide();
    renderCenter();
    window.addEventListener('resize', onResize);
    Sound.unlock();
  }

  let rt = null;
  function onResize() { clearTimeout(rt); rt = setTimeout(() => { if (cur && !cur.busy) { renderBoard(); renderCenter(); } }, 120); }

  function boardSize() {
    const body = cur.root.querySelector('#mpBody');
    const side = cur.root.querySelector('#mpSide');
    const wide = body.clientWidth > body.clientHeight * 1.2;
    body.classList.toggle('wide', wide);
    const sw = wide ? side.getBoundingClientRect().width + 20 : 0;
    const sh = wide ? 0 : Math.min(220, body.clientHeight * 0.32);
    return Math.max(260, Math.floor(Math.min(body.clientWidth - sw - 16, body.clientHeight - sh - 16)));
  }

  function renderBoard() {
    const board = cur.root.querySelector('#mpBoard');
    const S = boardSize();
    board.style.width = S + 'px'; board.style.height = S + 'px';
    board.style.setProperty('--c', (S / 7) + 'px');
    const owners = G().owners;
    const byId = Object.fromEntries(students().map((s) => [s.id, s]));
    board.innerHTML = TILES.map((t, i) => {
      const [r, c] = cellOf(i);
      const o = owners[i] && byId[owners[i]];
      return `<div class="mp-tile t-${t.t}${i % 6 === 0 ? ' corner' : ''}" data-i="${i}" style="grid-row:${r + 1};grid-column:${c + 1}">
        ${t.color ? `<i class="band" style="background:${t.color}"></i>` : ''}
        <div class="ti">${t.icon}</div><div class="tn">${esc(t.name)}</div>
        ${t.t === 'prop' ? `<div class="tp">${o ? `🏠 ${esc(o.name)}` : `💰${t.price}`}</div>` : ''}
        ${o ? `<div class="town">${Avatar.html(o, Math.round(S / 7 * 0.26))}</div>` : ''}
      </div>`;
    }).join('') + `<div class="mp-center" id="mpCenter"></div><div class="mp-tokens" id="mpTokens"></div>`;
    placeTokens(false);
  }

  // 棋子：同一格有好幾個人時，排開一點
  function tokenXY(i, k, n) {
    const S = cur.root.querySelector('#mpBoard').clientWidth, c = S / 7;
    const [r, col] = cellOf(i);
    const off = n > 1 ? [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.2], [0.2, 0.2], [0, 0.04], [0, -0.3], [-0.3, 0.05], [0.3, 0.05]][k % 8] : [0, 0.04];
    return [col * c + c / 2 + off[0] * c, r * c + c / 2 + off[1] * c];
  }
  function placeTokens(animate) {
    const layer = cur.root.querySelector('#mpTokens');
    const S = cur.root.querySelector('#mpBoard').clientWidth, size = Math.round(S / 7 * 0.42);
    const groups = {};
    students().forEach((s) => { const p = mp(s).pos; (groups[p] = groups[p] || []).push(s); });
    students().forEach((s) => {
      let el = layer.querySelector(`[data-tok="${s.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'mp-token';
        el.dataset.tok = s.id;
        el.innerHTML = Avatar.html(s, size);
        layer.appendChild(el);
      }
      const g = groups[mp(s).pos];
      const [x, y] = tokenXY(mp(s).pos, g.indexOf(s), g.length);
      el.style.transition = animate ? '' : 'none';
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      el.classList.toggle('sel', s.id === cur.sel);
    });
  }

  function renderSide() {
    const side = cur.root.querySelector('#mpSide');
    const list = students().slice();
    side.innerHTML = `<div class="ms-head">玩家（點一下選誰擲骰）</div>` + (list.length ? list.map((s) => {
      const m = mp(s);
      return `<div class="ms-row${s.id === cur.sel ? ' sel' : ''}" data-sid="${s.id}">
        ${Avatar.html(s, 34)}
        <div class="ms-info"><b>${esc(s.name)}</b><div class="ms-stats">💰${m.coins}${m.deposit ? ` 🏦${m.deposit}` : ''}${propsOf(s).length ? ` 🏠${propsOf(s).length}` : ''}${m.debt ? ` <span class="debt">欠${m.debt}</span>` : ''}${m.insured ? ' 🛡️' : ''}</div></div>
        <div class="ms-rolls" title="擲骰機會">🎲${m.rolls}</div>
        <button class="ms-give" data-give="${s.id}" title="老師送 1 次擲骰機會">＋</button>
      </div>`;
    }).join('') : '<div class="muted">還沒有學生</div>');
    side.onclick = (e) => {
      if (cur.busy) return;
      const give = e.target.closest('[data-give]');
      if (give) {
        const s = students().find((x) => x.id === give.dataset.give);
        W.snapshot(`${s.name} 送擲骰`);
        mp(s).rolls++; log(s, '老師送 1 次擲骰機會'); W.save(); Sound.ticket();
        renderSide(); renderCenter();
        return;
      }
      const row = e.target.closest('[data-sid]');
      if (row) { cur.sel = row.dataset.sid; renderSide(); renderCenter(); placeTokens(false); }
    };
  }

  const selStudent = () => students().find((s) => s.id === cur.sel);

  // 中間：目前的玩家、骰子、擲骰按鈕
  function renderCenter() {
    const box = cur.root.querySelector('#mpCenter');
    const s = selStudent();
    if (!s) { box.innerHTML = '<div class="mc-empty">先到 ⚙ 設定加入學生</div>'; return; }
    const m = mp(s);
    box.innerHTML = `
      <div class="mc-who">${Avatar.html(s, 44)}<div><b>${esc(s.name)}</b><div class="mc-sub">💰 ${m.coins}・🎲 ${m.rolls} 次・總資產 ${assets(s)}</div></div></div>
      <div class="mc-dice"><div class="mpd-scene"><div class="mpd-cube" id="mpCube">${[1, 6, 3, 4, 2, 5].map((n, k) => `<div class="mpd-face mf${k}">${pips(n)}</div>`).join('')}</div></div><div class="mpd-shadow"></div></div>
      <button class="go${m.rolls > 0 ? '' : ' off'}" id="mpRoll">${m.rolls > 0 ? '擲骰子！' : '還沒有擲骰機會'}</button>
      <div class="mc-hint">${m.rolls > 0 ? '按空白鍵也可以擲' : `再得 ${Math.max(1, Number(M().perRoll) || 5) - m.progress} 分就有 1 次機會`}</div>
      <div class="mc-card hidden" id="mpCard"></div>`;
    box.querySelector('#mpRoll').onclick = roll;
    setDie(cur.lastDie || 1, false);
  }

  const PIP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const pips = (n) => Array.from({ length: 9 }, (_, i) => `<i class="${PIP[n].includes(i) ? 'on' : ''}"></i>`).join('');
  // 面的順序：前1 後6 右3 左4 上2 下5 → 轉到正前方的角度
  const DIE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
  let spin = { x: 0, y: 0 };
  function setDie(n, animate) {
    const cube = cur.root.querySelector('#mpCube');
    if (!cube) return;
    const [bx, by] = DIE_ROT[n];
    if (animate) {
      spin.x = bx + 360 * (3 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? 1 : -1);
      spin.y = by + 360 * (2 + Math.floor(Math.random() * 2));
    } else { spin = { x: bx, y: by }; }
    cube.style.transition = animate ? 'transform 1.25s cubic-bezier(.2,.75,.25,1)' : 'none';
    cube.style.transform = `rotateX(${spin.x}deg) rotateY(${spin.y}deg)`;
  }

  // ---------- 擲骰、移動 ----------
  async function roll() {
    if (!cur || cur.busy) return;
    const s = selStudent();
    if (!s) return;
    const m = mp(s);
    if (m.rolls < 1) { W.toast(`${s.name} 還沒有擲骰機會（好行為每 ${M().perRoll} 分換 1 次）`, false); Sound.minus(); return; }
    W.snapshot(`${s.name} 大富翁擲骰`);
    m.rolls--;
    cur.busy = true;
    cur.root.classList.add('busy');
    const n = 1 + Math.floor(Math.random() * 6);
    cur.lastDie = n;
    const dice = cur.root.querySelector('.mc-dice');
    dice.classList.remove('jump'); void dice.offsetWidth; dice.classList.add('jump');
    Sound.whoosh();
    setDie(n, true);
    for (let i = 0; i < 8; i++) setTimeout(() => Sound.tick(), i * 120);
    await sleep(1300);
    Sound.clunk();
    cur.root.querySelector('.mc-hint').textContent = `擲出 ${n} 點！`;
    await sleep(350);
    for (let k = 0; k < n; k++) {
      m.pos = (m.pos + 1) % TILES.length;
      if (m.pos === 0) await passStart(s);
      placeTokens(true);
      const tok = cur.root.querySelector(`[data-tok="${s.id}"]`);
      tok.classList.remove('hop'); void tok.offsetWidth; tok.classList.add('hop');
      Sound.tap(k / n);
      await sleep(300);
    }
    Sound.clunk();
    await sleep(250);
    await land(s, m.pos);
    W.save();
    cur.busy = false;
    cur.root.classList.remove('busy');
    // 輪到下一位還有擲骰機會的人（大家輪流）
    const next = nextPlayer(s) || (mp(s).rolls > 0 ? s : null);
    if (next) cur.sel = next.id;
    renderBoard(); renderSide(); renderCenter();
    W.renderAll();
  }

  function nextPlayer(after) {
    const list = students();
    const i = list.indexOf(after);
    for (let k = 1; k <= list.length; k++) { const s = list[(i + k) % list.length]; if (mp(s).rolls > 0) return s; }
    return null;
  }

  // 經過起點：領薪水、存款加利息、先還欠款
  async function passStart(s) {
    const m = mp(s);
    const pay = Number(M().salary) || 50;
    const interest = Math.floor(m.deposit * 0.1);
    m.deposit += interest;
    let got = pay;
    let repay = 0;
    if (m.debt > 0) { repay = Math.min(m.debt, got); m.debt -= repay; got -= repay; }
    m.coins += got;
    log(s, `經過起點：薪水 +${pay}${interest ? `、利息 +${interest}` : ''}${repay ? `、還欠款 ${repay}` : ''}`);
    Sound.ticket();
    W.toast(`${s.name} 領薪水 +${pay} 💰${interest ? `，存款利息 +${interest}` : ''}${repay ? `，先還欠款 ${repay}` : ''}`, false);
    burstAt(0);
  }

  function burstAt(i, colors) {
    const t = cur.root.querySelector(`.mp-tile[data-i="${i}"]`);
    if (!t) return;
    const r = cur.root.getBoundingClientRect(), b = t.getBoundingClientRect();
    FX.burst(cur.root, b.left - r.left + b.width / 2, b.top - r.top + b.height / 2, 24, colors || ['#ffd54f', '#ffffff', '#81d4fa']);
  }

  // 錢的進出：付不出來的部分記成欠款（不會破產、不會出局）
  function pay(s, amt, to) {
    const m = mp(s);
    const paid = Math.min(m.coins, amt);
    m.coins -= paid;
    const owe = amt - paid;
    if (owe > 0) m.debt += owe;
    if (to) mp(to).coins += amt;
    return owe;
  }
  function gain(s, amt) { mp(s).coins += amt; }

  // ---------- 卡片視窗 ----------
  function card({ icon, title, topic, text, buttons }) {
    return new Promise((resolve) => {
      const box = cur.root.querySelector('#mpCard');
      box.innerHTML = `
        <div class="mcc-head">${icon ? `<span class="mcc-ic">${icon}</span>` : ''}<b>${esc(title)}</b>${topic ? `<span class="mcc-topic" style="--tc:${TOPIC_COLOR[topic] || '#666'}">${topic}</span>` : ''}</div>
        <div class="mcc-text">${text}</div>
        <div class="mcc-btns">${buttons.map((b, i) => `<button data-b="${i}" class="${b.cls || ''}"${b.disabled ? ' disabled' : ''}>${b.label}</button>`).join('')}</div>`;
      box.classList.remove('hidden', 'pop'); void box.offsetWidth; box.classList.add('pop');
      box.querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { box.classList.add('hidden'); resolve(Number(b.dataset.b)); });
    });
  }
  const ok = (title, text, icon, topic) => card({ icon, title, topic, text, buttons: [{ label: '好！', cls: 'primary' }] });

  async function land(s, i) {
    const t = TILES[i];
    const m = mp(s);
    if (t.t === 'start') { await ok('起點', '剛好停在起點，休息一下 😊', '🏁'); return; }
    if (t.t === 'prop') {
      const owner = students().find((x) => x.id === ownerOf(i));
      if (!owner) {
        const can = m.coins >= t.price;
        const pick = await card({ icon: t.icon, title: t.name, topic: '財商',
          text: `這塊地還沒有主人。價錢 💰${t.price}，買了以後別人停在這裡要付你 💰${t.rent} 租金。<div class="mcc-cost">${can ? `買：剩 💰${m.coins - t.price}，但以後可能收租金（也可能都沒人來）<br>不買：💰${m.coins} 都留著` : `你只有 💰${m.coins}，錢不夠買`}</div>`,
          buttons: can ? [{ label: `買下來（−${t.price}）`, cls: 'primary' }, { label: '不買，錢留著' }] : [{ label: '好吧', cls: 'primary' }] });
        if (can && pick === 0) {
          m.coins -= t.price; G().owners[i] = s.id;
          log(s, `買下 ${t.name}（−${t.price}）`);
          Sound.fanfare(); burstAt(i, ['#ffd54f', '#ffffff', t.color]);
          await ok('買下來了！', `${esc(t.name)} 現在是你的地 🏠`, t.icon);
        } else if (can) { log(s, `沒有買 ${t.name}`); }
        return;
      }
      if (owner.id === s.id) { await ok(t.name, '這是你自己的地 🏠，不用付錢。', t.icon); return; }
      const owe = pay(s, t.rent, owner);
      log(s, `付 ${owner.name} 租金 ${t.rent}${owe ? `（欠 ${owe}）` : ''}`);
      Sound.minus();
      await ok('付租金', `${esc(t.name)} 是 ${esc(owner.name)} 的地，付租金 💰${t.rent}。${owe ? `<div class="mcc-cost">錢不夠，先欠 💰${owe}，下次領薪水時還。</div>` : ''}`, t.icon, '財商');
      return;
    }
    if (t.t === 'chance' || t.t === 'fate') { await drawCard(s, t.t, t); return; }
    if (t.t === 'court' || t.t === 'eco' || t.t === 'friend') { await drawCard(s, t.t, t); return; }
    if (t.t === 'bank') {
      const opts = [];
      if (m.coins >= 20) opts.push({ label: '存 20 💰', act: 'dep' });
      if (m.debt === 0) opts.push({ label: '借 50 💰（下次經過起點還 55）', act: 'loan' });
      opts.push({ label: '都不要', act: 'none' });
      const pick = await card({ icon: '🏦', title: '銀行', topic: '財商',
        text: `存款每次經過起點會多 10% 利息。<div class="mcc-cost">現在：💰${m.coins}・🏦 存款 ${m.deposit}${m.debt ? `・欠 ${m.debt}` : ''}</div>`,
        buttons: opts.map((o, k) => ({ label: o.label, cls: k === 0 ? 'primary' : '' })) });
      const act = opts[pick].act;
      if (act === 'dep') { m.coins -= 20; m.deposit += 20; log(s, '存款 20'); Sound.ticket(); }
      if (act === 'loan') { m.coins += 50; m.debt += 55; log(s, '向銀行借 50（要還 55）'); Sound.ticket(); await ok('借到錢了', '借錢要付利息：借 50，要還 55。按時還錢就是有信用。', '🏦', '財商'); }
      return;
    }
    if (t.t === 'insure') {
      if (m.insured) { await ok('保險公司', '你已經有保險了 🛡️', '🛡️', '財商'); return; }
      const can = m.coins >= 15;
      const pick = await card({ icon: '🛡️', title: '保險公司', topic: '財商',
        text: `花 💰15 買保險，下次遇到可以保險的意外（例如腳踏車壞了），只要付 💰5。<div class="mcc-cost">不買：省下 15，但意外來了要全部自己付</div>`,
        buttons: can ? [{ label: '買保險（−15）', cls: 'primary' }, { label: '不買' }] : [{ label: '錢不夠，好吧', cls: 'primary' }] });
      if (can && pick === 0) { m.coins -= 15; m.insured = true; log(s, '買保險（−15）'); Sound.ticket(); }
      return;
    }
    if (t.t === 'shop') {
      const opts = [
        { label: '✏️ 鉛筆用完了，買新的（−10）', amt: 10, need: true },
        { label: '🧸 買新玩具（−40）', amt: 40, need: false },
        { label: '都不買' }
      ].filter((o) => !o.amt || m.coins >= o.amt);
      const pick = await card({ icon: '🛒', title: '商店', topic: '財商', text: '你想買什麼？想一想：這是「需要」還是「想要」？',
        buttons: opts.map((o, k) => ({ label: o.label, cls: k === 0 ? 'primary' : '' })) });
      const o = opts[pick];
      if (o.amt) { m.coins -= o.amt; log(s, `商店：${o.need ? '需要' : '想要'}（−${o.amt}）`); }
      await ok('想一想', `${o.amt ? (o.need ? '鉛筆是<b>需要</b>：上課一定要用。' : '玩具是<b>想要</b>：有了很開心，沒有也可以生活。') : '你選擇把錢留著。'}<div class="mcc-cost">需要＝生活中一定要用的；想要＝有了很好，沒有也可以。</div>`, '🛒', '財商');
      return;
    }
    if (t.t === 'lucky') {
      const amt = [5, 10, 10, 15, 20, 30][Math.floor(Math.random() * 6)];
      const stop = FX.suspense(cur.root, 1200);
      await sleep(1200); stop();
      gain(s, amt); log(s, `幸運抽獎 +${amt}`);
      FX.win(cur.root, amt >= 30 ? 'big' : 'small');
      await ok('幸運抽獎', `抽到 💰${amt}！`, '🎁');
      FX.clear(cur.root);
    }
  }

  const decks = {};
  function nextCard(deck) {
    if (!decks[deck] || !decks[deck].length) decks[deck] = shuffle(CARDS.filter((c) => (deck === 'chance' || deck === 'fate') ? (c.deck === 'chance' || c.deck === 'fate') && (c.deck === deck || Math.random() < 0.3) : c.deck === deck));
    return decks[deck].pop();
  }

  async function drawCard(s, deck, tile) {
    const c = nextCard(deck);
    const m = mp(s);
    const title = tile.name;
    if (c.kind === 'gain') {
      gain(s, c.amt); log(s, `${title}：${c.text} +${c.amt}`);
      Sound.win(); burstAt(m.pos);
      await ok(title, `${c.text}<div class="mcc-amt up">+${c.amt} 💰</div>${c.why ? `<div class="mcc-why">${c.why}</div>` : ''}`, tile.icon, c.topic);
    } else if (c.kind === 'loss') {
      let amt = c.amt, note = '';
      if (c.insurable && m.insured) { amt = 5; m.insured = false; note = '<div class="mcc-why">🛡️ 你有保險，只要付 5！</div>'; }
      const owe = pay(s, amt);
      log(s, `${title}：${c.text} −${amt}`);
      Sound.zero();
      await ok(title, `${c.text}<div class="mcc-amt down">−${amt} 💰</div>${note}${owe ? `<div class="mcc-cost">錢不夠，先欠 💰${owe}</div>` : ''}${c.why ? `<div class="mcc-why">${c.why}</div>` : ''}`, tile.icon, c.topic);
    } else if (c.kind === 'choice') {
      const opts = c.options.filter((o) => o.amt >= 0 || m.coins >= -o.amt);
      const pick = await card({ icon: tile.icon, title, topic: c.topic, text: c.text, buttons: opts.map((o, k) => ({ label: o.label, cls: k === 0 ? 'primary' : '' })) });
      const o = opts[pick];
      if (o.amt) { if (o.amt > 0) gain(s, o.amt); else pay(s, -o.amt); }
      log(s, `${title}：${o.label}`);
      await ok(title, `${o.after}<div class="mcc-cost">選了一個，就放棄了另一個，這就是「取捨」。</div>`, tile.icon, c.topic);
    } else if (c.kind === 'quiz') {
      const opts = shuffle(c.options);
      const pick = await card({ icon: tile.icon, title, topic: c.topic, text: c.text, buttons: opts.map((o) => ({ label: o.label })) });
      if (opts[pick].ok) {
        gain(s, c.reward); log(s, `${title}：答對「${c.text}」+${c.reward}`);
        Sound.win(); burstAt(m.pos, ['#a5d6a7', '#ffffff', '#ffd54f']);
        await ok('答對了！', `${c.why}<div class="mcc-amt up">+${c.reward} 💰</div>`, '✅', c.topic);
      } else {
        log(s, `${title}：再想想「${c.text}」`);
        Sound.zero();
        const right = c.options.find((o) => o.ok).label;
        await ok('再想想', `比較好的做法是：<b>${esc(right)}</b><div class="mcc-why">${c.why}</div>`, '💡', c.topic);
      }
    }
  }

  function close() {
    if (!cur) return;
    cur.root.remove();
    cur = null;
    window.removeEventListener('resize', onResize);
    W.renderAll();
  }

  // 重新開始一局：金幣、位置、地產、欠款歸零（擲骰機會保留）
  function reset() {
    W.snapshot('大富翁新的一局');
    D().monopoly = { owners: {} };
    D().classes.forEach((c) => c.students.forEach((s) => {
      const rolls = s.mp ? s.mp.rolls : 0, progress = s.mp ? s.mp.progress : 0;
      s.mp = null; mp(s); s.mp.rolls = rolls; s.mp.progress = progress;
    }));
    W.save();
  }

  function onKey(e) {
    if (!cur) return false;
    if (e.key === 'Escape') { if (!cur.busy) close(); return true; }
    if ((e.key === ' ' || e.key === 'Enter') && !cur.busy) {
      e.preventDefault();
      const cardEl = cur.root.querySelector('#mpCard');
      if (cardEl && !cardEl.classList.contains('hidden')) return true;
      roll();
    }
    return true;
  }

  return { open, close, onKey, onPoints, reset, isOpen: () => !!cur, TILES, CARDS, mp };
})();
