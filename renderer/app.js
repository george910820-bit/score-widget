// 學生加分小工具 — 畫面邏輯（第二版）
(() => {
  'use strict';

  // ---------- 小圖示 ----------
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    pin: svg('<path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/>'),
    undo: svg('<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>'),
    mini: svg('<path d="M4 15h16"/><path d="M4 19h16"/><rect x="4" y="4" width="16" height="7" rx="2"/>'),
    expand: svg('<path d="M16 4h4v4"/><path d="M14 10l6 -6"/><path d="M8 20h-4v-4"/><path d="M4 20l6 -6"/>'),
    shrink: svg('<path d="M5 9h4v-4"/><path d="M3 3l6 6"/><path d="M19 15h-4v4"/><path d="M21 21l-6 -6"/>'),
    gear: svg('<path d="M10.3 4.3c.4 -1.8 3 -1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5 -.9 3.3 .8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8 .4 1.8 3 0 3.4a1.7 1.7 0 0 0 -1 2.6c.9 1.5 -.9 3.3 -2.4 2.4a1.7 1.7 0 0 0 -2.6 1c-.4 1.8 -3 1.8 -3.4 0a1.7 1.7 0 0 0 -2.6 -1c-1.5 .9 -3.3 -.9 -2.4 -2.4a1.7 1.7 0 0 0 -1 -2.6c-1.8 -.4 -1.8 -3 0 -3.4a1.7 1.7 0 0 0 1 -2.5c-.9 -1.6 .9 -3.3 2.4 -2.4a1.7 1.7 0 0 0 2.6 -1.1"/><circle cx="12" cy="12" r="3"/>'),
    minimize: svg('<path d="M5 12h14"/>'),
    close: svg('<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>'),
    back: svg('<path d="M15 6l-6 6l6 6"/>'),
    soundOn: svg('<path d="M15 8a5 5 0 0 1 0 8"/><path d="M17.7 5a9 9 0 0 1 0 14"/><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/>'),
    soundOff: svg('<path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/><path d="M16 10l4 4m0 -4l-4 4"/>'),
    screen: svg('<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>')
  };
  const $ = (id) => document.getElementById(id);
  const setIcon = (id, name) => { $(id).innerHTML = ICON[name]; };
  [['btnPin', 'pin'], ['btnMiniPin', 'pin'], ['btnUndo', 'undo'], ['btnMini', 'mini'], ['btnExpand', 'expand'],
    ['btnSettings', 'gear'], ['btnMinimize', 'minimize'], ['btnClose', 'close'], ['btnBack', 'back'],
    ['dUndo', 'undo'], ['dSettings', 'gear'], ['dExit', 'shrink'], ['dClose', 'close']].forEach(([id, n]) => setIcon(id, n));

  // ---------- 資料 ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const HISTORY_MAX = 50000;
  const BALL_COLORS = ['#9aa5b1', '#2e9d5b', '#3b82f6', '#f59e0b', '#e85d75', '#8b5cf6', '#14b8a6', '#ef4444'];

  function defaultPools() {
    return [
      { id: uid(), name: '建立期', items: [
        { id: uid(), type: 'points', points: 0, count: 2, color: '#9aa5b1' },
        { id: uid(), type: 'points', points: 1, count: 4, color: '#2e9d5b' },
        { id: uid(), type: 'points', points: 2, count: 3, color: '#3b82f6' },
        { id: uid(), type: 'points', points: 5, count: 1, color: '#f59e0b' }
      ] },
      { id: uid(), name: '穩定期', items: [
        { id: uid(), type: 'points', points: 0, count: 5, color: '#9aa5b1' },
        { id: uid(), type: 'points', points: 1, count: 3, color: '#2e9d5b' },
        { id: uid(), type: 'points', points: 3, count: 1, color: '#f59e0b' },
        { id: uid(), type: 'prize', name: '貼紙', points: 0, count: 1, color: '#e85d75' }
      ] }
    ];
  }
  function defaultRewards() {
    return [
      { id: uid(), icon: '🌟', name: '貼紙', cost: 10 },
      { id: uid(), icon: '🪑', name: '選座位', cost: 20 },
      { id: uid(), icon: '🎮', name: '自由時間 5 分鐘', cost: 30 }
    ];
  }
  function defaultSettings() {
    return {
      step: 1, sort: 'list', noNegative: true, opacity: 100, zoom: 100,
      sound: { on: true, volume: 70, plus: null, minus: null, fileVersion: 0 },
      lottery: { skin: 'gacha', baseOne: true, replace: false, pityOn: true, pityN: 4, ticketMode: 'free', ticketEvery: 5 }
    };
  }
  function defaultData() {
    const id = uid();
    const pools = defaultPools();
    return {
      version: 2,
      currentClassId: id,
      classes: [{ id, name: '我的班級', students: [] }],
      history: [],
      settings: defaultSettings(),
      pools,
      activePoolId: pools[0].id,
      lotteryRemain: null,
      rewards: defaultRewards()
    };
  }

  // 讀進來的資料（包含第一版的舊資料）補齊缺少的欄位
  function normalize(d) {
    const base = defaultData();
    if (!d || typeof d !== 'object') return base;
    const out = { ...base, ...d };
    const ds = defaultSettings();
    const s = d.settings || {};
    out.settings = { ...ds, ...s, sound: { ...ds.sound, ...(s.sound || {}) }, lottery: { ...ds.lottery, ...(s.lottery || {}) } };
    if (!Array.isArray(out.classes) || !out.classes.length) out.classes = base.classes;
    out.classes.forEach((c) => {
      if (!c.id) c.id = uid();
      if (!Array.isArray(c.students)) c.students = [];
      c.students.forEach((st) => {
        if (!st.id) st.id = uid();
        st.score = Number(st.score) || 0;
        st.tickets = Number(st.tickets) || 0;
        st.ticketProgress = Number(st.ticketProgress) || 0;
        st.pityMiss = Number(st.pityMiss) || 0;
        if (st.avatar === undefined) st.avatar = null;
      });
    });
    if (!Array.isArray(out.history)) out.history = [];
    if (!Array.isArray(out.pools) || !out.pools.length) out.pools = base.pools;
    out.pools.forEach((p) => {
      if (!p.id) p.id = uid();
      if (!Array.isArray(p.items)) p.items = [];
      p.items.forEach((it, i) => {
        if (!it.id) it.id = uid();
        if (!it.type) it.type = 'points';
        it.points = Number(it.points) || 0;
        it.count = Math.max(0, Math.round(Number(it.count) || 0));
        if (!it.color) it.color = BALL_COLORS[i % BALL_COLORS.length];
      });
    });
    if (!out.pools.some((p) => p.id === out.activePoolId)) out.activePoolId = out.pools[0].id;
    if (!Array.isArray(out.rewards)) out.rewards = base.rewards;
    if (!out.classes.some((c) => c.id === out.currentClassId)) out.currentClassId = out.classes[0].id;
    out.version = 2;
    return out;
  }

  let data = defaultData();
  let dataUrl = '';
  let pinned = true;
  let mini = false;
  let display = false;
  const undoStack = [];

  const cls = () => data.classes.find((c) => c.id === data.currentClassId) || data.classes[0];
  const findStudent = (id) => cls().students.find((x) => x.id === id);

  function save() {
    if (data.history.length > HISTORY_MAX) data.history.splice(0, data.history.length - HISTORY_MAX);
    window.api.save(data);
  }

  // 改資料之前先記一份（紀錄很長，所以只記長度），按「復原」就回到上一步
  function snapshot(label) {
    const { history, ...rest } = data;
    undoStack.push({ label, json: JSON.stringify(rest), hlen: history.length });
    if (undoStack.length > 60) undoStack.shift();
    updateUndoBtn();
  }

  function undo() {
    const last = undoStack.pop();
    if (!last) { toast('沒有可以復原的動作', false); return; }
    const rest = JSON.parse(last.json);
    rest.history = data.history.slice(0, last.hlen);
    data = normalize(rest);
    save();
    Sound.configure(data.settings.sound);
    renderAll();
    toast('已復原：' + last.label, false);
  }

  function updateUndoBtn() {
    $('btnUndo').classList.toggle('off', undoStack.length === 0);
    $('dUndo').classList.toggle('off', undoStack.length === 0);
  }

  // ---------- 加減分 ----------
  function changeScore(studentId, sign) {
    const c = cls();
    const s = findStudent(studentId);
    if (!s) return;
    Sound.unlock();
    const step = Number(data.settings.step) || 1;
    let next = s.score + sign * step;
    if (data.settings.noNegative && next < 0) next = 0;
    const delta = next - s.score;
    if (delta === 0) { flash(studentId, -1, 0); Sound.minus(); return; }
    snapshot(`${s.name} ${delta > 0 ? '+' : ''}${delta}`);
    s.score = next;
    data.history.push({ t: new Date().toISOString(), type: 'manual', classId: c.id, studentId: s.id, name: s.name, delta, score: next });
    let gotTicket = 0;
    const l = data.settings.lottery;
    if (delta > 0 && l.ticketMode === 'ticket') {
      s.ticketProgress += delta;
      const every = Math.max(1, Number(l.ticketEvery) || 5);
      while (s.ticketProgress >= every) { s.ticketProgress -= every; s.tickets++; gotTicket++; }
      if (gotTicket) data.history.push({ t: new Date().toISOString(), type: 'ticket', classId: c.id, studentId: s.id, name: s.name, delta: 0, score: next, item: `獲得抽獎券 ${gotTicket} 張` });
    }
    save();
    renderScores();
    flash(studentId, sign, delta);
    if (delta > 0) Sound.plus(); else Sound.minus();
    if (gotTicket) {
      setTimeout(() => Sound.ticket(), 250);
      toast(`${s.name} 拿到 ${gotTicket} 張抽獎券 🎟`, true);
    } else {
      toast(`${s.name} ${delta > 0 ? '+' : ''}${delta}　⭐ ${next}`, true);
    }
  }

  function flash(studentId, sign, delta) {
    const cssClass = sign > 0 ? 'bump-up' : 'bump-down';
    document.querySelectorAll(`[data-id="${studentId}"]`).forEach((el) => {
      el.classList.remove('bump-up', 'bump-down');
      void el.offsetWidth;
      el.classList.add(cssClass);
      if ((el.classList.contains('row') || el.classList.contains('dcard')) && delta) {
        const f = document.createElement('span');
        f.className = 'float ' + (delta > 0 ? 'up' : 'down');
        f.textContent = (delta > 0 ? '+' : '') + delta;
        el.appendChild(f);
        setTimeout(() => f.remove(), 1000);
        if (delta > 0 && el.classList.contains('dcard')) sparkle(el);
      }
    });
  }

  // 展示模式加分時冒出小星星
  function sparkle(card) {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = '★';
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 60;
      s.style.setProperty('--dx', Math.cos(a) * r + 'px');
      s.style.setProperty('--dy', Math.sin(a) * r + 'px');
      s.style.color = ['#f5b82e', '#ffd166', '#2e9d5b', '#e85d75'][i % 4];
      card.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  function sortedStudents() {
    const list = cls().students.slice();
    if (data.settings.sort === 'score') list.sort((a, b) => b.score - a.score);
    return list;
  }

  // 離下一個獎勵還差幾點
  function rewardProgress(score) {
    const rs = data.rewards.filter((r) => Number(r.cost) > 0).slice().sort((a, b) => a.cost - b.cost);
    if (!rs.length) return null;
    const can = rs.filter((r) => r.cost <= score);
    const next = rs.find((r) => r.cost > score);
    if (can.length) {
      const best = can[can.length - 1];
      return { pct: 100, can: true, text: `可以兌換「${best.name}」了！` };
    }
    return { pct: Math.round(score / next.cost * 100), can: false, text: `離「${next.name}」還差 ${next.cost - score} 點` };
  }

  // ---------- 畫面 ----------
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const ticketMode = () => data.settings.lottery.ticketMode === 'ticket';

  function renderClassSelect() {
    const sel = $('classSelect');
    sel.innerHTML = data.classes.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    sel.value = data.currentClassId;
  }

  function lottoBtn(s, cssClass) {
    const t = ticketMode();
    const n = s.tickets || 0;
    const off = t && n === 0;
    return `<button class="${cssClass}${off ? ' off' : ''}" data-act="lotto" title="${t ? `抽獎（抽獎券 ${n} 張）` : '抽獎'}">🎰${t ? `<i class="badge">${n}</i>` : ''}</button>`;
  }

  function renderList() {
    const list = $('list');
    const students = sortedStudents();
    if (!students.length) {
      list.innerHTML = `<div class="empty">這個班級還沒有學生<br><button id="btnEmptyAdd">＋ 新增學生名單</button></div>`;
      $('btnEmptyAdd').onclick = () => openSettings('roster', true);
    } else {
      list.innerHTML = students.map((s) => {
        const rp = rewardProgress(s.score);
        return `
        <div class="row" data-id="${s.id}">
          <button class="name" data-act="name" title="左鍵 +・右鍵 −">${esc(s.name)}</button>
          <button class="score${rp && rp.can ? ' can' : ''}" data-act="sheet" title="點一下打開學生小卡（抽獎、兌換、頭貼）"><span class="star">★</span>${s.score}${rp && rp.can ? '<i class="gift">🎁</i>' : ''}</button>
          <button class="pm minus" data-act="minus" title="扣分">−</button>
          <button class="pm plus" data-act="plus" title="加分">＋</button>
          ${lottoBtn(s, 'pm lotto')}
        </div>`;
      }).join('');
    }
    const total = students.reduce((sum, s) => sum + s.score, 0);
    $('summary').textContent = `共 ${students.length} 人・合計 ${total} 分`;
  }

  // 展示模式：依人數和視窗大小，算出讓卡片最大的排法
  function gridLayout(n) {
    const g = $('grid');
    const W0 = g.clientWidth - 24, H0 = g.clientHeight - 24;
    let best = { c: 1, u: 10 };
    for (let c = 1; c <= Math.max(1, n); c++) {
      const r = Math.ceil(n / c);
      const cw = (W0 - (c - 1) * 16) / c, ch = (H0 - (r - 1) * 16) / r;
      const u = Math.min(cw / 10, ch / 13.2);
      if (u > best.u) best = { c, u };
    }
    best.u = Math.max(10, Math.min(best.u, 46));
    return best;
  }

  function renderGrid() {
    const c = cls();
    const students = sortedStudents();
    $('dClass').textContent = c.name;
    const total = students.reduce((sum, s) => sum + s.score, 0);
    $('dSummary').textContent = `共 ${students.length} 人・合計 ${total} 分`;
    const g = $('grid');
    if (!students.length) {
      g.style.gridTemplateColumns = '1fr';
      g.innerHTML = `<div class="empty big">這個班級還沒有學生<br><button id="btnEmptyAdd2">＋ 新增學生名單</button></div>`;
      $('btnEmptyAdd2').onclick = () => openSettings('roster', true);
      return;
    }
    const { c: cols, u } = gridLayout(students.length);
    g.style.gridTemplateColumns = `repeat(${cols}, minmax(0, ${Math.round(u * 10)}px))`;
    g.style.setProperty('--u', u + 'px');
    g.classList.toggle('compact', u < 19);
    g.innerHTML = students.map((s) => {
      const rp = rewardProgress(s.score);
      return `
      <div class="dcard" data-id="${s.id}">
        <button class="d-avatar" data-act="name" title="左鍵 +・右鍵 −">${Avatar.html(s, Math.round(u * 4.4))}</button>
        <div class="d-name">${esc(s.name)}</div>
        <button class="d-score" data-act="sheet" title="打開學生小卡"><span class="star">★</span>${s.score}</button>
        ${rp ? `<div class="d-prog${rp.can ? ' can' : ''}"><div class="bar"><i style="width:${rp.pct}%"></i></div><span>${esc(rp.text)}</span></div>` : '<div class="d-prog"></div>'}
        <div class="d-btns">
          <button class="pm minus" data-act="minus" title="扣分">−</button>
          <button class="pm plus" data-act="plus" title="加分">＋</button>
          ${lottoBtn(s, 'pm lotto')}
          <button class="pm gift${rp && rp.can ? ' can' : ''}" data-act="redeem" title="兌換獎勵">🎁</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderMini() {
    const box = $('miniChips');
    const students = sortedStudents();
    box.innerHTML = students.length
      ? students.map((s) => `<button class="chip" data-id="${s.id}" title="左鍵 +・右鍵 −">${esc(s.name)}<b>${s.score}</b></button>`).join('')
      : `<span style="padding:4px 6px;opacity:.8">還沒有學生</span>`;
    if (mini) requestAnimationFrame(fitMini);
  }

  function renderPin() {
    $('btnPin').classList.toggle('off', !pinned);
    $('btnMiniPin').classList.toggle('off', !pinned);
    const t = pinned ? '已置頂（點一下取消）' : '沒有置頂（點一下置頂）';
    $('btnPin').title = t; $('btnMiniPin').title = t;
  }

  function renderSoundBtn() {
    const on = data.settings.sound.on;
    $('btnSound').innerHTML = (on ? ICON.soundOn : ICON.soundOff) + `<span>${on ? '音效開' : '靜音'}</span>`;
    $('dSound').innerHTML = on ? ICON.soundOn : ICON.soundOff;
    $('dSound').classList.toggle('off', !on);
    $('btnDisplay').innerHTML = ICON.screen + '<span>展示模式</span>';
  }

  function renderScores() {
    if (display) renderGrid(); else renderList();
    renderMini();
  }

  function renderAll() {
    renderClassSelect();
    renderList();
    if (display) renderGrid();
    renderMini();
    renderPin();
    renderSoundBtn();
    updateUndoBtn();
    if (!$('settings').classList.contains('hidden')) renderSettings();
  }

  // ---------- 展示模式（最大化） ----------
  function setDisplay(on) {
    display = !!on;
    document.body.classList.toggle('is-display', display);
    if (display) requestAnimationFrame(renderGrid);
    else renderList();
  }
  let gridTimer = null;
  window.addEventListener('resize', () => {
    if (!display) return;
    clearTimeout(gridTimer);
    gridTimer = setTimeout(renderGrid, 80);
  });

  // ---------- 迷你模式 ----------
  function miniHeight() {
    const z = (Number(data.settings.zoom) || 100) / 100;
    return Math.ceil($('mini').getBoundingClientRect().height * z);
  }
  function fitMini() { if (mini) window.api.fit(miniHeight()); }

  async function setMini(on) {
    mini = on;
    document.body.classList.toggle('is-mini', on);
    if (on) {
      renderMini();
      await new Promise((r) => requestAnimationFrame(r));
      await window.api.setMini(true, miniHeight());
    } else {
      await window.api.setMini(false);
    }
  }
  new ResizeObserver(() => fitMini()).observe($('mini'));

  // ---------- 提示、小卡 ----------
  let toastTimer = null;
  function toast(text, withUndo) {
    $('toastText').textContent = text;
    $('toastUndo').classList.toggle('hidden', !withUndo);
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2400);
  }

  let bannerTimer = null;
  function banner(html) {
    const b = $('banner');
    b.innerHTML = html;
    b.classList.remove('hidden');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
  }

  function confirmBox(text, okLabel = '確定') {
    return new Promise((resolve) => {
      $('modalText').textContent = text;
      $('modalOk').textContent = okLabel;
      $('modal').classList.remove('hidden');
      const done = (v) => { $('modal').classList.add('hidden'); $('modalOk').onclick = $('modalCancel').onclick = null; resolve(v); };
      $('modalOk').onclick = () => done(true);
      $('modalCancel').onclick = () => done(false);
    });
  }

  function openSheet(html, onMount) {
    $('sheetBox').innerHTML = html;
    $('sheet').classList.remove('hidden');
    if (onMount) onMount($('sheetBox'));
  }
  function closeSheet() {
    $('sheet').classList.add('hidden');
    $('sheetBox').innerHTML = '';
  }
  $('sheet').addEventListener('mousedown', (e) => { if (e.target === $('sheet')) closeSheet(); });

  const typeLabel = { manual: '', lottery: '抽獎', redeem: '兌換', ticket: '', reset: '' };
  function fmtTime(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function logLine(h) {
    let what;
    if (h.type === 'lottery') what = `抽獎「${esc(h.item)}」${h.delta >= 0 ? '+' : ''}${h.delta}${h.pity ? '（保底）' : ''}`;
    else if (h.type === 'redeem') what = `兌換「${esc(h.item)}」${h.delta}`;
    else if (h.type === 'ticket') what = esc(h.item || '獲得抽獎券');
    else if (h.studentId === null) what = esc(h.name);
    else what = `${h.delta > 0 ? '+' : ''}${h.delta}`;
    return `<div class="log"><span class="t">${fmtTime(h.t)}</span><span class="n">${h.studentId ? esc(h.name) : ''}</span><span class="w ${h.delta > 0 ? 'up' : h.delta < 0 ? 'down' : ''}">${what}</span></div>`;
  }

  // 學生小卡：抽獎、兌換、抽獎券、頭貼、最近紀錄
  function openStudentSheet(sid) {
    const s = findStudent(sid);
    if (!s) return;
    const rp = rewardProgress(s.score);
    const recent = data.history.filter((h) => h.studentId === s.id).slice(-6).reverse();
    const t = ticketMode();
    openSheet(`
      <div class="ss-head">
        <button class="ss-avatar" id="ssAvatar" title="換頭貼">${Avatar.html(s, 72)}<i>換頭貼</i></button>
        <div><div class="ss-name">${esc(s.name)}</div>
          <div class="ss-score"><span class="star">★</span>${s.score}${t ? `<span class="ss-ticket">🎟 ${s.tickets || 0} 張</span>` : ''}</div>
          ${rp ? `<div class="ss-prog${rp.can ? ' can' : ''}">${esc(rp.text)}</div>` : ''}
        </div>
      </div>
      <div class="ss-actions">
        <button id="ssLotto" class="primary">🎰 抽獎</button>
        <button id="ssRedeem">🎁 兌換獎勵</button>
        ${t ? '<button id="ssTicket">🎟 送 1 張抽獎券</button>' : ''}
      </div>
      <div class="picker-label">最近紀錄</div>
      <div class="log-list">${recent.length ? recent.map(logLine).join('') : '<div class="muted">還沒有紀錄</div>'}</div>
      <div class="btn-row end" style="margin-top:10px"><button id="ssClose">關閉</button></div>`, (root) => {
      root.querySelector('#ssAvatar').onclick = () => Avatar.openPicker(s, () => { renderAll(); openStudentSheet(sid); });
      root.querySelector('#ssLotto').onclick = () => { closeSheet(); openLotto(sid); };
      root.querySelector('#ssRedeem').onclick = () => openRedeem(sid);
      const tk = root.querySelector('#ssTicket');
      if (tk) tk.onclick = () => {
        snapshot(`${s.name} 抽獎券`);
        s.tickets = (s.tickets || 0) + 1;
        data.history.push({ t: new Date().toISOString(), type: 'ticket', classId: cls().id, studentId: s.id, name: s.name, delta: 0, score: s.score, item: '老師送抽獎券 1 張' });
        save(); Sound.ticket(); renderScores(); openStudentSheet(sid);
        toast(`${s.name} 拿到 1 張抽獎券 🎟`, true);
      };
      root.querySelector('#ssClose').onclick = closeSheet;
    });
  }

  function openLotto(sid) {
    const s = findStudent(sid);
    if (!s) return;
    if (ticketMode() && !(s.tickets > 0)) {
      toast(`${s.name} 還沒有抽獎券（每 ${data.settings.lottery.ticketEvery} 分送 1 張）`, false);
      return;
    }
    Lottery.open(s);
  }

  // 兌換獎勵
  function openRedeem(sid) {
    const s = findStudent(sid);
    if (!s) return;
    const rs = data.rewards.slice().sort((a, b) => a.cost - b.cost);
    openSheet(`
      <div class="ss-head small">${Avatar.html(s, 44)}<div><div class="ss-name">${esc(s.name)} 的兌換</div><div class="ss-score"><span class="star">★</span>${s.score} 點</div></div></div>
      <div class="redeem-list">${rs.length ? rs.map((r) => {
        const ok = s.score >= r.cost;
        return `<div class="redeem-row${ok ? '' : ' no'}"><span class="ic">${esc(r.icon || '🎁')}</span><span class="nm">${esc(r.name)}</span><span class="ct">${r.cost} 點</span>
          <button data-rid="${r.id}" class="${ok ? 'primary' : ''}">${ok ? '兌換' : `還差 ${r.cost - s.score}`}</button></div>`;
      }).join('') : '<p class="muted">還沒有設定獎勵，請到 ⚙ 設定 → 獎勵 新增。</p>'}</div>
      <div class="btn-row end" style="margin-top:10px"><button id="rdClose">關閉</button></div>`, (root) => {
      root.querySelectorAll('[data-rid]').forEach((b) => b.onclick = () => {
        const r = data.rewards.find((x) => x.id === b.dataset.rid);
        if (!r || s.score < r.cost) { Sound.minus(); return; }
        snapshot(`${s.name} 兌換 ${r.name}`);
        s.score -= r.cost;
        data.history.push({ t: new Date().toISOString(), type: 'redeem', classId: cls().id, studentId: s.id, name: s.name, delta: -r.cost, score: s.score, item: r.name });
        save();
        closeSheet();
        renderScores();
        Sound.fanfare();
        Lottery.confetti(200);
        banner(`<div class="b-ic">${esc(r.icon || '🎁')}</div><div><b>${esc(s.name)}</b> 兌換了「${esc(r.name)}」！</div>`);
        toast(`${s.name} 兌換「${r.name}」−${r.cost}`, true);
      });
      root.querySelector('#rdClose').onclick = closeSheet;
    });
  }

  // ---------- 設定 ----------
  let curTab = 'roster';
  function openSettings(tab, focusPaste) {
    if (Lottery.isOpen()) Lottery.close();
    closeSheet();
    $('settings').classList.remove('hidden');
    showTab(tab || curTab);
    if (focusPaste) setTimeout(() => $('inPaste').focus(), 50);
  }
  function closeSettings() {
    $('settings').classList.add('hidden');
    renderAll();
  }
  function showTab(tab) {
    curTab = tab;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
    document.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== tab));
    renderSettings();
    document.querySelector('.settings-body').scrollTop = 0;
  }
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });

  function renderSettings() {
    const c = cls();
    const st = data.settings;
    // 名單
    $('inClassName').value = c.name;
    $('studentEditList').innerHTML = c.students.length
      ? c.students.map((s, i) => `
        <div class="edit-row" data-sid="${s.id}">
          <span class="num">${i + 1}</span>
          <button class="av-btn" data-edit="avatar" title="換頭貼">${Avatar.html(s, 32)}</button>
          <input type="text" value="${esc(s.name)}" maxlength="20" data-edit="name">
          <span class="sc">★ ${s.score}</span>
          <button data-edit="del" class="del" title="刪除這位學生">刪除</button>
        </div>`).join('')
      : `<div class="edit-empty">還沒有學生，可以在下面貼上名單。</div>`;
    // 加減分
    $('inStep').value = String(st.step);
    $('inSort').value = st.sort;
    $('inNoNeg').checked = !!st.noNegative;
    // 抽獎機
    renderLotterySettings();
    // 獎勵
    renderRewardSettings();
    // 音效
    $('inSoundOn').checked = !!st.sound.on;
    $('inVolume').value = st.sound.volume;
    $('outVolume').textContent = st.sound.volume + '%';
    $('plusSoundName').textContent = st.sound.plus ? '目前用：自己的音檔' : '目前用：內建音效（清脆的兩聲）';
    $('minusSoundName').textContent = st.sound.minus ? '目前用：自己的音檔' : '目前用：內建音效（輕柔的一聲，不刺耳）';
    // 外觀
    $('inOpacity').value = st.opacity;
    $('outOpacity').textContent = st.opacity + '%';
    $('inZoom').value = st.zoom;
    $('outZoom').textContent = st.zoom + '%';
    // 紀錄
    if (curTab === 'stats') renderStats();
  }

  function renderLotterySettings() {
    const l = data.settings.lottery;
    document.querySelectorAll('input[name=ticketMode]').forEach((r) => { r.checked = r.value === l.ticketMode; });
    $('inTicketEvery').value = l.ticketEvery;
    $('rowTicketEvery').classList.toggle('dim', l.ticketMode !== 'ticket');
    $('ticketHint').classList.toggle('dim', l.ticketMode !== 'ticket');
    $('inBaseOne').checked = !!l.baseOne;
    document.querySelectorAll('input[name=replace]').forEach((r) => { r.checked = (r.value === 'yes') === !!l.replace; });
    $('inPityOn').checked = !!l.pityOn;
    $('inPityN').value = l.pityN;
    $('inSkin').innerHTML = Lottery.SKINS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    $('inSkin').value = l.skin;
    // 獎池
    const pool = Lottery.activePool();
    $('inPool').innerHTML = data.pools.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    $('inPool').value = pool.id;
    $('inPoolName').value = pool.name;
    const total = pool.items.reduce((a, it) => a + (Number(it.count) || 0), 0);
    $('itemList').innerHTML = pool.items.map((it) => `
      <div class="item-row" data-iid="${it.id}">
        <button class="color-dot" data-ed="color" style="background:${it.color}" title="點一下換顏色"></button>
        <select data-ed="type"><option value="points"${it.type !== 'prize' ? ' selected' : ''}>加分</option><option value="prize"${it.type === 'prize' ? ' selected' : ''}>獎品</option></select>
        ${it.type === 'prize'
          ? `<input data-ed="name" type="text" value="${esc(it.name || '')}" maxlength="8" placeholder="獎品名稱">`
          : `<input data-ed="points" type="number" step="1" min="0" max="99" value="${it.points}" title="加幾分（0＝沒加碼）">`}
        <input data-ed="count" type="number" step="1" min="0" max="99" value="${it.count}" title="放幾顆球">
        <span class="pct">${total ? Math.round(it.count / total * 100) : 0}%</span>
        <button data-ed="del" class="del" title="刪除">✕</button>
      </div>`).join('') || '<div class="edit-empty">還沒有球，按下面新增。</div>';
    const hit = pool.items.filter(Lottery.isHit).reduce((a, it) => a + (Number(it.count) || 0), 0);
    const avg = hit ? (total / hit) : 0;
    $('poolSummary').innerHTML = total
      ? `共 ${total} 顆球・有加碼的機率 <b>${Math.round(hit / total * 100)}%</b>${hit ? `，平均 <b>${avg.toFixed(1).replace('.0', '')}</b> 次加碼一次` : ''}`
      : '獎池是空的';
    // 這一輪剩下
    if (l.replace) {
      $('remainBox').innerHTML = '';
    } else {
      const ws = Lottery.weights(pool);
      const left = ws.reduce((a, b) => a + b.w, 0);
      $('remainBox').innerHTML = `<div class="remain-balls">${ws.map((x) => `<span class="rb" style="--c:${x.item.color}">${esc(Lottery.label(x.item))} × ${x.w}</span>`).join('')}</div>
        <div class="btn-row"><span class="muted" style="margin:0;align-self:center">這一輪還剩 ${left} 顆</span><button id="btnRefill">重新裝滿</button></div>`;
      $('btnRefill').onclick = () => { snapshot('重新裝滿'); Lottery.refill(pool); save(); renderLotterySettings(); toast('已重新裝滿', true); };
    }
  }

  function renderRewardSettings() {
    $('rewardList').innerHTML = data.rewards.map((r) => `
      <div class="reward-row" data-rid="${r.id}">
        <input data-rw="icon" type="text" value="${esc(r.icon || '')}" maxlength="4" class="icon-in" title="可以貼上表情符號">
        <input data-rw="name" type="text" value="${esc(r.name)}" maxlength="16">
        <input data-rw="cost" type="number" min="1" max="9999" step="1" value="${r.cost}">
        <button data-rw="del" class="del" title="刪除">✕</button>
      </div>`).join('') || '<div class="edit-empty">還沒有獎勵。</div>';
  }

  function renderStats() {
    const range = $('inRange').value;
    const now = Date.now();
    let from = 0;
    if (range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); from = d.getTime(); }
    if (range === 'week') from = now - 7 * 864e5;
    if (range === 'month') from = now - 30 * 864e5;
    const c = cls();
    const hs = data.history.filter((h) => h.classId === c.id && new Date(h.t).getTime() >= from);
    const rows = c.students.map((s) => {
      const mine = hs.filter((h) => h.studentId === s.id);
      const plus = mine.filter((h) => h.type === 'manual' && h.delta > 0).reduce((a, h) => a + h.delta, 0);
      const minus = mine.filter((h) => h.type === 'manual' && h.delta < 0).reduce((a, h) => a - h.delta, 0);
      const draws = mine.filter((h) => h.type === 'lottery');
      const hits = draws.filter((h) => h.hit).length;
      const redeem = mine.filter((h) => h.type === 'redeem').length;
      return `<tr><td>${esc(s.name)}</td><td class="up">+${plus}</td><td class="down">−${minus}</td><td>${draws.length}</td><td>${hits}</td><td>${hits ? (draws.length / hits).toFixed(1).replace('.0', '') : '−'}</td><td>${redeem}</td></tr>`;
    }).join('');
    $('statsTable').innerHTML = `<thead><tr><th>學生</th><th>加分</th><th>扣分</th><th>抽獎</th><th>有加碼</th><th>平均幾次一加碼</th><th>兌換</th></tr></thead><tbody>${rows || '<tr><td colspan="7">還沒有學生</td></tr>'}</tbody>`;
    const recent = hs.slice(-40).reverse();
    $('logList').innerHTML = recent.length ? recent.map(logLine).join('') : '<div class="muted">這段期間還沒有紀錄</div>';
  }
  $('inRange').onchange = renderStats;

  // 名單
  $('inClassName').addEventListener('change', (e) => {
    const name = e.target.value.trim();
    if (!name) { e.target.value = cls().name; return; }
    snapshot('班級改名');
    cls().name = name;
    save(); renderClassSelect();
  });
  $('btnAddClass').onclick = () => {
    snapshot('新增班級');
    const id = uid();
    data.classes.push({ id, name: `班級 ${data.classes.length + 1}`, students: [] });
    data.currentClassId = id;
    save(); renderAll();
    $('inClassName').focus(); $('inClassName').select();
  };
  $('btnDelClass').onclick = async () => {
    const c = cls();
    if (data.classes.length === 1) { toast('至少要保留一個班級', false); return; }
    if (!(await confirmBox(`確定要刪除「${c.name}」和裡面 ${c.students.length} 位學生的分數嗎？\n（刪錯了可以按復原）`, '刪除'))) return;
    snapshot('刪除班級');
    data.classes = data.classes.filter((x) => x.id !== c.id);
    data.currentClassId = data.classes[0].id;
    save(); renderAll();
  };
  $('studentEditList').addEventListener('change', (e) => {
    if (e.target.dataset.edit !== 'name') return;
    const s = findStudent(e.target.closest('.edit-row').dataset.sid);
    const name = e.target.value.trim();
    if (!s) return;
    if (!name) { e.target.value = s.name; return; }
    snapshot('學生改名');
    s.name = name;
    save();
  });
  $('studentEditList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const sid = btn.closest('.edit-row').dataset.sid;
    const s = findStudent(sid);
    if (!s) return;
    if (btn.dataset.edit === 'avatar') { Avatar.openPicker(s, renderSettings); return; }
    if (btn.dataset.edit !== 'del') return;
    if (!(await confirmBox(`確定要刪除「${s.name}」嗎？`, '刪除'))) return;
    snapshot('刪除學生');
    cls().students = cls().students.filter((x) => x.id !== sid);
    save(); renderSettings();
  });
  $('btnPaste').onclick = () => {
    const names = $('inPaste').value.split(/[\r\n\t,，、]+/).map((n) => n.trim()).filter(Boolean);
    if (!names.length) { toast('請先貼上學生名字', false); $('inPaste').focus(); return; }
    const c = cls();
    const existing = new Set(c.students.map((s) => s.name));
    const fresh = [...new Set(names)].filter((n) => !existing.has(n));
    if (!fresh.length) { toast('這些學生都已經在名單裡了', false); return; }
    snapshot('加入名單');
    fresh.forEach((name) => c.students.push({ id: uid(), name: name.slice(0, 20), score: 0, tickets: 0, ticketProgress: 0, pityMiss: 0, avatar: null }));
    $('inPaste').value = '';
    save(); renderSettings();
    toast(`已加入 ${fresh.length} 位學生`, false);
  };

  // 加減分
  $('inStep').onchange = (e) => { data.settings.step = Number(e.target.value); save(); };
  $('inSort').onchange = (e) => { data.settings.sort = e.target.value; save(); };
  $('inNoNeg').onchange = (e) => { data.settings.noNegative = e.target.checked; save(); };
  $('btnResetScores').onclick = async () => {
    const c = cls();
    if (!(await confirmBox(`確定要把「${c.name}」全部學生的分數歸零嗎？\n（抽獎券也會一起歸零；歸零錯了可以按復原）`, '歸零'))) return;
    snapshot('分數歸零');
    c.students.forEach((s) => { s.score = 0; s.tickets = 0; s.ticketProgress = 0; s.pityMiss = 0; });
    data.history.push({ t: new Date().toISOString(), type: 'reset', classId: c.id, studentId: null, name: '（全班歸零）', delta: 0, score: 0 });
    save(); renderSettings();
    toast('分數已歸零', true);
  };

  // 抽獎機設定
  const L = () => data.settings.lottery;
  document.querySelectorAll('input[name=ticketMode]').forEach((r) => r.onchange = () => { L().ticketMode = r.value; save(); renderLotterySettings(); });
  $('inTicketEvery').onchange = (e) => { L().ticketEvery = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 5))); save(); renderLotterySettings(); };
  $('inBaseOne').onchange = (e) => { L().baseOne = e.target.checked; save(); };
  document.querySelectorAll('input[name=replace]').forEach((r) => r.onchange = () => { L().replace = r.value === 'yes'; save(); renderLotterySettings(); });
  $('inPityOn').onchange = (e) => { L().pityOn = e.target.checked; save(); };
  $('inPityN').onchange = (e) => { L().pityN = Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 4))); save(); renderLotterySettings(); };
  $('inSkin').onchange = (e) => { L().skin = e.target.value; save(); };
  $('inPool').onchange = (e) => { data.activePoolId = e.target.value; save(); renderLotterySettings(); };
  $('inPoolName').onchange = (e) => {
    const n = e.target.value.trim();
    if (!n) { renderLotterySettings(); return; }
    snapshot('獎池改名'); Lottery.activePool().name = n; save(); renderLotterySettings();
  };
  $('btnPoolAdd').onclick = () => {
    snapshot('新增獎池');
    const p = { id: uid(), name: `獎池 ${data.pools.length + 1}`, items: [
      { id: uid(), type: 'points', points: 0, count: 3, color: BALL_COLORS[0] },
      { id: uid(), type: 'points', points: 1, count: 3, color: BALL_COLORS[1] }
    ] };
    data.pools.push(p); data.activePoolId = p.id; save(); renderLotterySettings();
    $('inPoolName').focus(); $('inPoolName').select();
  };
  $('btnPoolCopy').onclick = () => {
    snapshot('複製獎池');
    const src = Lottery.activePool();
    const p = { id: uid(), name: src.name + ' 複本', items: src.items.map((it) => ({ ...it, id: uid() })) };
    data.pools.push(p); data.activePoolId = p.id; save(); renderLotterySettings();
  };
  $('btnPoolDel').onclick = async () => {
    if (data.pools.length === 1) { toast('至少要保留一個獎池', false); return; }
    const p = Lottery.activePool();
    if (!(await confirmBox(`確定要刪除獎池「${p.name}」嗎？`, '刪除'))) return;
    snapshot('刪除獎池');
    data.pools = data.pools.filter((x) => x.id !== p.id);
    data.activePoolId = data.pools[0].id;
    save(); renderLotterySettings();
  };
  $('btnItemAdd').onclick = () => {
    const p = Lottery.activePool();
    snapshot('新增球');
    p.items.push({ id: uid(), type: 'points', points: 1, count: 1, color: BALL_COLORS[p.items.length % BALL_COLORS.length] });
    data.lotteryRemain = null;
    save(); renderLotterySettings();
  };
  $('itemList').addEventListener('change', (e) => {
    const row = e.target.closest('.item-row');
    if (!row) return;
    const it = Lottery.activePool().items.find((x) => x.id === row.dataset.iid);
    if (!it) return;
    snapshot('修改獎池');
    const ed = e.target.dataset.ed;
    if (ed === 'type') { it.type = e.target.value; if (it.type === 'prize' && !it.name) it.name = '獎品'; }
    if (ed === 'points') it.points = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)));
    if (ed === 'name') it.name = e.target.value.trim() || '獎品';
    if (ed === 'count') it.count = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)));
    data.lotteryRemain = null; // 改了獎池，這一輪重新裝滿
    save(); renderLotterySettings();
  });
  $('itemList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ed]');
    if (!btn) return;
    const p = Lottery.activePool();
    const it = p.items.find((x) => x.id === btn.closest('.item-row').dataset.iid);
    if (!it) return;
    if (btn.dataset.ed === 'color') {
      snapshot('換顏色');
      it.color = BALL_COLORS[(BALL_COLORS.indexOf(it.color) + 1) % BALL_COLORS.length];
      save(); renderLotterySettings();
    }
    if (btn.dataset.ed === 'del') {
      snapshot('刪除球');
      p.items = p.items.filter((x) => x !== it);
      data.lotteryRemain = null;
      save(); renderLotterySettings();
    }
  });

  // 獎勵設定
  $('btnRewardAdd').onclick = () => {
    snapshot('新增獎勵');
    const max = data.rewards.reduce((m, r) => Math.max(m, r.cost), 0);
    data.rewards.push({ id: uid(), icon: '🎁', name: '新獎勵', cost: max + 10 });
    save(); renderRewardSettings();
  };
  $('rewardList').addEventListener('change', (e) => {
    const row = e.target.closest('.reward-row');
    if (!row) return;
    const r = data.rewards.find((x) => x.id === row.dataset.rid);
    if (!r) return;
    snapshot('修改獎勵');
    const k = e.target.dataset.rw;
    if (k === 'icon') r.icon = e.target.value.trim();
    if (k === 'name') r.name = e.target.value.trim() || r.name;
    if (k === 'cost') r.cost = Math.max(1, Math.min(9999, Math.round(Number(e.target.value) || 1)));
    save(); renderRewardSettings();
  });
  $('rewardList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rw="del"]');
    if (!b) return;
    snapshot('刪除獎勵');
    data.rewards = data.rewards.filter((x) => x.id !== b.closest('.reward-row').dataset.rid);
    save(); renderRewardSettings();
  });

  // 音效設定
  const applySound = () => { Sound.configure(data.settings.sound); renderSoundBtn(); };
  $('inSoundOn').onchange = (e) => { data.settings.sound.on = e.target.checked; save(); applySound(); };
  $('inVolume').oninput = (e) => { data.settings.sound.volume = Number(e.target.value); $('outVolume').textContent = e.target.value + '%'; applySound(); };
  $('inVolume').onchange = () => { save(); Sound.test('plus'); };
  let pickKind = null;
  document.querySelector('[data-pane="sound"]').addEventListener('click', (e) => {
    const t = e.target.closest('[data-test]'), p = e.target.closest('[data-pick]'), r = e.target.closest('[data-reset]');
    if (t) Sound.test(t.dataset.test);
    if (p) { pickKind = p.dataset.pick; $('inSoundFile').value = ''; $('inSoundFile').click(); }
    if (r) {
      data.settings.sound[r.dataset.reset] = null;
      save(); applySound(); renderSettings(); Sound.test(r.dataset.reset);
    }
  });
  $('inSoundFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f || !pickKind) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) { toast('請選 mp3、wav、ogg 或 m4a 音檔', false); return; }
    if (f.size > 5 * 1024 * 1024) { toast('音檔太大了，請選 5MB 以下的短音效', false); return; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const rel = `sounds/${pickKind}.${ext}`;
    try { await window.api.saveFile(rel, bytes); } catch (err) { toast('音檔存不進去，請再試一次', false); return; }
    data.settings.sound[pickKind] = rel;
    data.settings.sound.fileVersion = Date.now();
    save(); applySound(); renderSettings(); Sound.test(pickKind);
    toast('已換成你的音檔', false);
  };

  // 外觀
  $('inOpacity').oninput = (e) => {
    data.settings.opacity = Number(e.target.value);
    $('outOpacity').textContent = data.settings.opacity + '%';
    window.api.setOpacity(data.settings.opacity / 100);
  };
  $('inOpacity').onchange = save;
  $('inZoom').onchange = (e) => {
    data.settings.zoom = Number(e.target.value);
    $('outZoom').textContent = data.settings.zoom + '%';
    window.api.setZoom(data.settings.zoom / 100);
    save();
  };
  $('inZoom').oninput = (e) => { $('outZoom').textContent = e.target.value + '%'; };
  $('btnOpenDir').onclick = () => window.api.openDataDir();

  // ---------- 按鈕與滑鼠 ----------
  function onAct(e, rightClick) {
    const card = e.target.closest('[data-id]');
    const act = e.target.closest('[data-act]');
    if (!card || !act) return;
    const id = card.dataset.id;
    const a = act.dataset.act;
    if (rightClick) { if (a === 'name') changeScore(id, -1); return; }
    if (a === 'name' || a === 'plus') changeScore(id, 1);
    else if (a === 'minus') changeScore(id, -1);
    else if (a === 'sheet') openStudentSheet(id);
    else if (a === 'lotto') openLotto(id);
    else if (a === 'redeem') openRedeem(id);
  }
  ['list', 'grid'].forEach((id) => {
    $(id).addEventListener('click', (e) => onAct(e, false));
    $(id).addEventListener('contextmenu', (e) => { e.preventDefault(); onAct(e, true); });
  });
  $('miniChips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) changeScore(c.dataset.id, 1); });
  $('miniChips').addEventListener('contextmenu', (e) => { e.preventDefault(); const c = e.target.closest('.chip'); if (c) changeScore(c.dataset.id, -1); });
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });

  $('classSelect').onchange = (e) => {
    data.currentClassId = e.target.value;
    save(); renderScores();
  };

  const togglePin = async () => { pinned = await window.api.setPin(!pinned); renderPin(); toast(pinned ? '已置頂' : '已取消置頂', false); };
  const toggleSound = () => { data.settings.sound.on = !data.settings.sound.on; save(); applySound(); toast(data.settings.sound.on ? '音效開' : '已靜音', false); };
  $('btnPin').onclick = togglePin;
  $('btnMiniPin').onclick = togglePin;
  $('btnUndo').onclick = undo;
  $('dUndo').onclick = undo;
  $('toastUndo').onclick = undo;
  $('btnMini').onclick = () => setMini(true);
  $('btnExpand').onclick = () => setMini(false);
  $('btnSettings').onclick = () => openSettings();
  $('dSettings').onclick = () => openSettings();
  $('btnBack').onclick = closeSettings;
  $('btnMinimize').onclick = () => window.api.minimize();
  $('btnClose').onclick = () => window.api.close();
  $('dClose').onclick = () => window.api.close();
  $('btnSound').onclick = toggleSound;
  $('dSound').onclick = toggleSound;
  $('btnDisplay').onclick = () => window.api.toggleMax();
  $('dExit').onclick = () => window.api.toggleMax();
  window.api.onMaximized((v) => setDisplay(v));

  document.addEventListener('keydown', (e) => {
    if (Lottery.isOpen()) { Lottery.onKey(e); return; }
    const typing = e.target.closest('input, textarea, select');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
    if (e.key === 'Escape') {
      if (!$('modal').classList.contains('hidden')) $('modalCancel').click();
      else if (!$('sheet').classList.contains('hidden')) closeSheet();
      else if (!$('settings').classList.contains('hidden')) closeSettings();
    }
  });
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

  // ---------- 給其他檔案用的 ----------
  window.W = {
    get data() { return data; },
    cls, save, snapshot, renderAll, toast, banner, openSheet, closeSheet,
    fileUrl: (rel, v) => dataUrl + rel + (v ? '?v=' + v : '')
  };

  // ---------- 啟動 ----------
  (async () => {
    const res = await window.api.load();
    data = normalize(res && res.data);
    pinned = res ? res.pinned !== false : true;
    dataUrl = (res && res.dataUrl) || '';
    $('dataPath').textContent = (res && res.dataDir) || '';
    Sound.configure(data.settings.sound, dataUrl);
    window.api.setOpacity((Number(data.settings.opacity) || 100) / 100);
    window.api.setZoom((Number(data.settings.zoom) || 100) / 100);
    renderAll();
    if (res && res.mini) setMini(true);
    save();
  })();
})();
