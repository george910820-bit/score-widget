// 刮刮樂：九宮格，刮出 3 個一樣的圖案就中獎
// 跟真的刮刮樂一樣，買下（用入場券）的那一刻結果就決定好了，刮只是把它打開
window.Scratch = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const Z = () => W.data.settings.zone;
  const price = () => Number(Z().price) || 10;
  const SYMS = () => Slot.SYMS;

  let cur = null;
  let onCloseCb = null;

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // 產生一張卡：先決定中不中、中哪一種，再排圖案（沒中的卡不會有 3 個一樣）
  function makeCard() {
    const table = Z().scratch.slice().sort((a, b) => a.chance - b.chance);
    let r = Math.random() * 100, winRow = null;
    for (const row of table) { r -= row.chance; if (r < 0) { winRow = row; break; } }
    const cells = [];
    const counts = {};
    const put = (sym) => { cells.push(sym); counts[sym] = (counts[sym] || 0) + 1; };
    if (winRow) for (let i = 0; i < 3; i++) put(winRow.sym);
    const others = SYMS().filter((x) => !winRow || x !== winRow.sym);
    while (cells.length < 9) {
      const pool = others.filter((x) => (counts[x] || 0) < 2);
      put(pool[Math.floor(Math.random() * pool.length)]);
    }
    return { cells: shuffle(cells), win: winRow };
  }

  function open(student, onClose) {
    close();
    onCloseCb = onClose || null;
    if ((student.zoneTickets || 0) < 1) { W.toast('入場券不夠，先到遊戲區換一張', false); if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(student); } return; }
    // 用掉 1 張入場券，結果馬上記錄
    W.snapshot(`${student.name} 刮刮樂`);
    const card = makeCard();
    student.zoneTickets -= 1;
    const prize = card.win ? Number(card.win.prize) || 0 : 0;
    student.score += prize;
    W.data.history.push({
      t: new Date().toISOString(), type: 'scratch', classId: W.cls().id, studentId: student.id, name: student.name,
      delta: prize, score: student.score, item: card.win ? card.win.sym : '沒中', win: !!card.win, prize, tickets: 1
    });
    W.save();

    const root = document.createElement('div');
    root.className = 'scratch-overlay';
    const legend = Z().scratch.slice().sort((a, b) => b.prize - a.prize)
      .map((row) => `<span class="sc-leg">${row.sym}${row.sym}${row.sym} <b>${row.prize} 點</b></span>`).join('');
    root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(student, 40)}<div><b>${esc(student.name)}</b><div class="lotto-sub" id="scSub"></div></div></div>
        <div class="slot-title">🎫 刮刮樂</div>
        <button class="icon-btn lotto-x" id="scClose" title="回遊戲區（Esc）">✕</button>
      </div>
      <div class="sc-main" id="scMain"><div class="fx-behind"></div>
        <div class="sc-card" id="scCard">
          <div class="sc-head"><div class="sc-title">刮刮樂</div><div class="sc-rule">刮出 <b>3 個一樣</b> 的圖案就中獎！</div><div class="sc-legend">${legend}</div></div>
          <div class="sc-grid-wrap" id="scWrap">
            <div class="sc-grid">${card.cells.map((x, i) => `<div class="sc-cell" data-i="${i}"><span>${x}</span></div>`).join('')}</div>
            <canvas class="sc-foil" id="scFoil"></canvas>
          </div>
        </div>
      </div>
      <div class="lotto-info" id="scInfo">用手指或滑鼠在銀色的地方刮刮看！</div>
      <div class="lotto-actions"><button class="go ghost" id="scAll">全部刮開</button></div>
      <div class="lotto-result hidden" id="scResult"></div>`;
    document.body.appendChild(root);
    cur = { student, card, root, revealed: new Array(9).fill(false), done: false, busy: false, prize };
    root.querySelector('#scClose').onclick = () => { if (!cur.busy) close(); };
    root.querySelector('#scAll').onclick = revealAll;
    renderSub();
    Sound.unlock();
    requestAnimationFrame(() => { layout(); drawFoil(); setupScratch(); });
    window.addEventListener('resize', onResize);
  }

  function renderSub() {
    const s = cur.student;
    // 刮完之前先不顯示加了幾分
    const shown = cur.done ? s.score : s.score - cur.prize;
    cur.root.querySelector('#scSub').textContent = `⭐ ${shown}・🎟 入場券 ${s.zoneTickets || 0} 張`;
  }

  function layout() {
    const main = cur.root.querySelector('#scMain');
    const cardEl = cur.root.querySelector('#scCard');
    const w = Math.max(220, Math.min(main.clientWidth - 16, (main.clientHeight - 8) / 1.45, 560));
    cardEl.style.width = w + 'px';
    cardEl.style.setProperty('--u', (w / 100) + 'px');
  }
  let rt = null;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!cur) return; layout(); drawFoil(true); }, 150);
  }

  // 銀色刮層
  function drawFoil(keep) {
    const cv = cur.root.querySelector('#scFoil');
    const wrap = cur.root.querySelector('#scWrap');
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cur.g = g; cur.w = w; cur.h = h; cur.dpr = dpr;
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#b8bec6'); grad.addColorStop(0.5, '#e4e7ea'); grad.addColorStop(1, '#aab1b9');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
    for (let x = -h; x < w; x += 14) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
    const cell = cellRects();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    cell.forEach((r, i) => {
      if (cur.revealed[i]) { g.clearRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2); return; }
      g.fillStyle = 'rgba(120,128,138,.35)';
      g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.font = `bold ${Math.round(r.w * 0.3)}px "Microsoft JhengHei UI", sans-serif`;
      g.fillText('刮', r.x + r.w / 2, r.y + r.h / 2 + 1);
    });
    if (keep) cur.root.querySelectorAll('.sc-cell').forEach((c, i) => c.classList.toggle('shown', cur.revealed[i]));
  }

  function cellRects() {
    const wrapR = cur.root.querySelector('#scWrap').getBoundingClientRect();
    return [...cur.root.querySelectorAll('.sc-cell')].map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.left - wrapR.left, y: r.top - wrapR.top, w: r.width, h: r.height };
    });
  }

  function setupScratch() {
    const cv = cur.root.querySelector('#scFoil');
    let down = false, last = null, lastSound = 0, lastCheck = 0;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const scrape = (p) => {
      const g = cur.g;
      const rad = Math.max(10, cur.w * 0.045);
      g.globalCompositeOperation = 'destination-out';
      g.lineCap = 'round'; g.lineWidth = rad * 2;
      g.beginPath();
      if (last) { g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); } else { g.arc(p.x, p.y, rad, 0, Math.PI * 2); g.fill(); }
      g.stroke();
      g.globalCompositeOperation = 'source-over';
      last = p;
      const now = performance.now();
      if (now - lastSound > 55) { Sound.scratch(); lastSound = now; }
      if (Math.random() < 0.35) {
        const r = cur.root.getBoundingClientRect(), cr = cv.getBoundingClientRect();
        FX.burst(cur.root, cr.left - r.left + p.x, cr.top - r.top + p.y, 3, ['#c9ced4', '#e9ecef', '#9aa3ad']);
      }
      if (now - lastCheck > 140) { lastCheck = now; check(); }
    };
    cv.onpointerdown = (e) => {
      if (!cur || cur.done || cur.busy) return;
      down = true; last = null;
      cv.setPointerCapture(e.pointerId);
      scrape(pos(e));
    };
    cv.onpointermove = (e) => { if (down) scrape(pos(e)); };
    cv.onpointerup = cv.onpointercancel = () => { down = false; last = null; if (cur) check(); };
  }

  // 每一格刮掉超過一半，就整格打開
  function check() {
    if (!cur || cur.done) return;
    const g = cur.g, dpr = cur.dpr;
    let img;
    try { img = g.getImageData(0, 0, Math.floor(cur.w * dpr), Math.floor(cur.h * dpr)); } catch (e) { return; }
    const W0 = img.width;
    cellRects().forEach((r, i) => {
      if (cur.revealed[i]) return;
      let clear = 0, n = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
        const x = Math.floor((r.x + r.w * a / 7) * dpr), y = Math.floor((r.y + r.h * b / 7) * dpr);
        const alpha = img.data[(y * W0 + x) * 4 + 3];
        n++; if (alpha < 100) clear++;
      }
      if (clear / n >= 0.45) revealCell(i);
    });
    if (cur.revealed.every(Boolean)) finish();
  }

  function revealCell(i) {
    cur.revealed[i] = true;
    const r = cellRects()[i];
    cur.g.clearRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    const el = cur.root.querySelectorAll('.sc-cell')[i];
    el.classList.add('shown');
    const sym = cur.card.cells[i];
    const seen = cur.card.cells.filter((x, k) => x === sym && cur.revealed[k]).length;
    Sound.reveal(seen >= 2 ? seen : 0);
  }

  async function revealAll() {
    if (!cur || cur.done || cur.busy) return;
    cur.busy = true;
    for (let i = 0; i < 9; i++) {
      if (!cur) return;
      if (!cur.revealed[i]) { revealCell(i); await sleep(260); }
    }
    cur.busy = false;
    finish();
  }

  // 全部刮開：對獎中…（等一下）→ 揭曉
  async function finish() {
    if (!cur || cur.done) return;
    cur.done = true; cur.busy = true;
    const root = cur.root;
    root.classList.add('busy');
    root.querySelector('.lotto-actions').classList.add('hidden');
    root.querySelector('#scInfo').textContent = '對獎中…';
    root.querySelector('#scCard').classList.add('checking');
    root.classList.add('dark');
    const stop = FX.suspense(root, 2800);
    await sleep(2800);
    stop();
    if (!cur || cur.root !== root) return;
    root.classList.remove('dark');
    root.querySelector('#scCard').classList.remove('checking');
    const win = cur.card.win;
    if (win) {
      cur.root.querySelectorAll('.sc-cell').forEach((c, i) => c.classList.toggle('match', cur.card.cells[i] === win.sym));
      const top = Math.max(...Z().scratch.map((x) => Number(x.prize) || 0));
      FX.win(root, Number(win.prize) >= top ? 'big' : 'small', root.querySelector('.fx-behind'));
    } else {
      FX.win(root, 'miss');
    }
    renderSub();
    W.renderAll();
    await sleep(1100);
    if (!cur || cur.root !== root) return;
    root.classList.remove('busy');
    cur.busy = false;
    showResult();
  }

  function showResult() {
    const s = cur.student, win = cur.card.win;
    const worth = price();
    const lines = win
      ? [`用 1 張入場券（值 ${worth} 點），拿到 ${win.prize} 點`]
      : [`用掉的 1 張入場券（值 ${worth} 點）拿不回來`];
    lines.push(`現在 ⭐ ${s.score}・🎟 ${s.zoneTickets || 0} 張`);
    const box = cur.root.querySelector('#scResult');
    box.innerHTML = `
      <div class="res-big ${win ? 'hit' : 'miss'}" style="--c:#d4a017">${win ? `${win.sym}${win.sym}${win.sym} 中了！+${win.prize}` : '沒中…'}</div>
      <div class="res-lines">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="btn-row center">
        ${(s.zoneTickets || 0) >= 1 ? '<button id="scAgain" class="primary">再刮一張</button>' : ''}
        <button id="scBack">回遊戲區</button>
      </div>`;
    box.classList.remove('hidden');
    const again = box.querySelector('#scAgain');
    if (again) again.onclick = () => { const st = cur.student, cb = onCloseCb; onCloseCb = null; teardown(); open(st, cb); };
    box.querySelector('#scBack').onclick = close;
  }

  function teardown() {
    if (!cur) return;
    cur.root.remove();
    cur = null;
    window.removeEventListener('resize', onResize);
  }

  function close() {
    if (!cur) return;
    const st = cur.student;
    teardown();
    W.renderAll();
    const cb = onCloseCb; onCloseCb = null;
    if (cb) cb(st);
  }

  function onKey(e) {
    if (!cur) return false;
    if (e.key === 'Escape') { if (!cur.busy) close(); return true; }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (cur.busy) return true;
      const res = cur.root.querySelector('#scResult');
      if (!res.classList.contains('hidden')) res.querySelector('button').click();
    }
    return true;
  }

  return { open, close, onKey, isOpen: () => !!cur, makeCard };
})();
