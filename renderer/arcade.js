// 遊樂場：彈珠台、夾娃娃機、猜大小、小動物賽跑、打地鼠、翻牌記憶配對、存錢機
// 每個遊戲用入場券玩，贏到的是點數 ⭐
window.Arcade = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const Z = () => W.data.settings.zone;
  const A = () => W.data.settings.arcade;
  const price = () => Number(Z().price) || 10;
  const grip0 = () => { const g = Number(A().clawGrip); return Number.isFinite(g) ? g : 30; };

  // ---------- 共用：遊戲畫面框架 ----------
  let cur = null;
  function shell({ student, icon, title, bg, back }) {
    if (cur) cur.close(true);
    const root = document.createElement('div');
    root.className = 'arcade-overlay';
    root.style.setProperty('--bg', bg || '#2b2150');
    root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(student, 40)}<div><b>${esc(student.name)}</b><div class="lotto-sub ar-sub"></div></div></div>
        <div class="slot-title">${icon} ${esc(title)}</div>
        <button class="icon-btn lotto-x ar-x" title="回遊樂場（Esc）">✕</button>
      </div>
      <div class="ar-main"><div class="fx-behind"></div><div class="ar-stage"></div></div>
      <div class="lotto-info ar-info"></div>
      <div class="lotto-actions ar-actions"></div>
      <div class="lotto-result hidden ar-result"></div>`;
    document.body.appendChild(root);
    const sh = {
      root, student, busy: false, cleanup: [],
      stage: root.querySelector('.ar-stage'),
      info: (html) => { root.querySelector('.ar-info').innerHTML = html; },
      actions: (html) => { const a = root.querySelector('.ar-actions'); a.innerHTML = html; return a; },
      sub() { root.querySelector('.ar-sub').textContent = `⭐ ${student.score}・🎟 入場券 ${student.zoneTickets || 0} 張`; },
      setBusy(b) { sh.busy = b; root.classList.toggle('busy', b); },
      result(big, hit, lines, buttons) {
        const box = root.querySelector('.ar-result');
        box.innerHTML = `<div class="res-big ${hit ? 'hit' : 'miss'}" style="--c:#d4a017">${big}</div>
          <div class="res-lines">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
          <div class="btn-row center">${buttons.map((b, i) => `<button data-rb="${i}" class="${b.primary ? 'primary' : ''}">${b.label}</button>`).join('')}</div>`;
        box.classList.remove('hidden');
        box.querySelectorAll('[data-rb]').forEach((el) => el.onclick = () => { box.classList.add('hidden'); FX.clear(root); buttons[Number(el.dataset.rb)].onClick(); });
      },
      hideResult() { root.querySelector('.ar-result').classList.add('hidden'); },
      close(silent) {
        if (sh.closed) return;
        sh.closed = true;
        sh.cleanup.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
        root.remove();
        if (cur === sh) cur = null;
        W.renderAll();
        if (!silent && back) back(student);
      }
    };
    root.querySelector('.ar-x').onclick = () => { if (!sh.busy) sh.close(); };
    sh.sub();
    cur = sh;
    Sound.unlock();
    return sh;
  }

  // 用入場券（按「復原」可以整個退回）
  function spend(s, n, game) {
    if ((s.zoneTickets || 0) < n) { W.toast('入場券不夠，先回遊樂場用點數換', false); Sound.minus(); return false; }
    W.snapshot(`${s.name} ${game}`);
    s.zoneTickets -= n;
    W.save();
    return true;
  }
  // 記錄結果：贏到的點數加到 ⭐
  function record(s, game, tickets, prize, extra) {
    if (prize > 0) s.score += prize;
    W.data.history.push({
      t: new Date().toISOString(), type: 'arcade', classId: W.cls().id, studentId: s.id, name: s.name,
      delta: prize, score: s.score, item: game, tickets, prize, win: prize > 0, ...(extra || {})
    });
    const note = Object.entries(extra || {}).map(([k, v]) => `${NOTE[k] || k}=${v === true ? '是' : v}`).join('；');
    Research.outcome(s, game, prize, tickets, note);
    W.save();
    W.renderAll();
  }
  const NOTE = { slot: '落在第幾格(0起)', tries: '這次連玩第幾次', rounds: '猜對幾關', lost: '輸掉的獎金', closed: '中途關掉', racer: '押', winner: '贏的是', bet: '押法', place: '押的那隻跑第幾名', hits: '打中', plush: '夾到', newPlush: '收藏冊新的一隻', mistakes: '翻錯', pairs: '幾對', flips: '按擋板次數' };
  const ticketWorth = (n) => `${n} 張入場券（值 ${n * price()} 點）`;

  // =====================================================================
  // 彈珠台（Plinko）：珠子撞釘子左右彈，落點分布會自己堆成「中間多、兩邊少」
  // =====================================================================
  const PL_ROWS = 8;
  function plinkoPrizes() {
    const arr = String(A().plinko || '').split(/[,，\s]+/).map((x) => Math.max(0, Math.round(Number(x) || 0)));
    return arr.length === PL_ROWS + 1 ? arr : [80, 30, 12, 5, 2, 5, 12, 30, 80];
  }
  // 彈珠台每一格的機率＝二項分布 C(8,k)/256
  function plinkoEV() {
    const pr = plinkoPrizes();
    let c = 1, ev = 0;
    for (let k = 0; k <= PL_ROWS; k++) { ev += c / 256 * pr[k]; c = c * (PL_ROWS - k) / (k + 1); }
    return ev;
  }
  function plinko(student, back) {
    const sh = shell({ student, icon: '🚀', title: '太空彈珠台', bg: '#05060f', back });
    sh.root.classList.add('pl');
    sh.stage.innerHTML = `
      <div class="pb">
        <div class="pb-tablewrap"><div class="pb-table" id="pbTable"><canvas class="pb-cv"></canvas></div></div>
        <div class="pb-side">
          <div class="pb-logo"><i>🚀</i><span>太空</span><b>彈珠台</b></div>
          <div class="pb-leds"><div class="pb-led"><span>BALL</span><b id="pbBall">1</b></div><div class="pb-led"><span>得分</span><b id="pbScore">0</b></div></div>
          <div class="pb-msg" id="pbMsg">等待發射</div>
          <div class="pb-hist"><div class="pb-hl">全班的珠子掉在哪裡</div><div class="pb-bars" id="pbBars"></div></div>
        </div>
      </div>`;
    const cv = sh.stage.querySelector('canvas');
    const table = sh.stage.querySelector('#pbTable');
    const prizes = plinkoPrizes();
    const top = Math.max(...prizes);
    const Wd = 360, H = 480, cx = 161, dx = 30, y0 = 118, dy = 28, PR = 5, BR = 8;
    const slotY = 338, laneX = 341;
    const COLORS = ['#00e5ff', '#ff4081', '#ffd740', '#69f0ae'];
    const hist = () => { const d = W.data; if (!d.arcade) d.arcade = {}; if (!Array.isArray(d.arcade.plinkoHist) || d.arcade.plinkoHist.length !== PL_ROWS + 1) d.arcade.plinkoHist = new Array(PL_ROWS + 1).fill(0); return d.arcade.plinkoHist; };
    const pegX = (i, j) => cx + (j - i / 2) * dx;
    const slotX = (k) => cx + (k - PL_ROWS / 2) * dx;
    // 背景星星（固定）
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * 322, y: Math.random() * H, r: Math.random() * 1.3 + 0.3, a: Math.random() }));
    let g, ball = null, flash = -1, plunge = 0, balls = 0, flips = 0, jitter = 0, raf = 0;
    const lit = {};
    const fl = { L: { a: 0, t: 0 }, R: { a: 0, t: 0 } };
    function size() {
      const st = sh.stage.getBoundingClientRect();
      const side = st.width > 620 ? 230 : 0;
      const s = Math.max(0.45, Math.min((st.width - side - 30) / Wd, (st.height - (side ? 30 : 90)) / H));
      const dpr = window.devicePixelRatio || 1;
      cv.style.width = Wd * s + 'px'; cv.style.height = H * s + 'px';
      cv.width = Wd * s * dpr; cv.height = H * s * dpr;
      g = cv.getContext('2d');
      g.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      sh.stage.querySelector('.pb').classList.toggle('narrow', !side);
    }
    function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function drawFlipper(px, py, dir, ang) {
      g.save(); g.translate(px, py); g.rotate(dir * ang);
      g.beginPath(); g.moveTo(0, -8); g.lineTo(dir * 60, -3); g.arc(dir * 60, 0, 3, -Math.PI / 2, Math.PI / 2, dir < 0); g.lineTo(0, 8); g.arc(0, 0, 8, Math.PI / 2, -Math.PI / 2, dir > 0); g.closePath();
      const gr = g.createLinearGradient(0, -8, 0, 8); gr.addColorStop(0, '#ff8a50'); gr.addColorStop(1, '#c62828');
      g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
      g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(0, 0, 3.5, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    function draw(now) {
      // 桌面
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a1050'); bg.addColorStop(0.55, '#0d1b4a'); bg.addColorStop(1, '#120a2e');
      g.fillStyle = '#05060f'; g.fillRect(0, 0, Wd, H);
      g.save();
      g.beginPath(); g.moveTo(4, H - 4); g.lineTo(4, 120); g.bezierCurveTo(4, 20, 120, 8, 200, 8); g.bezierCurveTo(300, 8, 356, 40, 356, 120); g.lineTo(356, H - 4); g.closePath();
      g.fillStyle = bg; g.fill(); g.clip();
      // 星雲與星球
      const neb = g.createRadialGradient(170, 230, 10, 170, 230, 180); neb.addColorStop(0, 'rgba(124,77,255,.35)'); neb.addColorStop(1, 'rgba(124,77,255,0)');
      g.fillStyle = neb; g.fillRect(0, 0, Wd, H);
      const pl = g.createRadialGradient(60, 70, 4, 70, 80, 34); pl.addColorStop(0, '#ffb74d'); pl.addColorStop(1, 'rgba(230,81,0,.0)');
      g.fillStyle = pl; g.beginPath(); g.arc(70, 80, 34, 0, Math.PI * 2); g.fill();
      stars.forEach((st) => { g.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.abs(Math.sin(now / 900 + st.a * 6))})`; g.fillRect(st.x, st.y, st.r, st.r); });
      // 中間的發光圓圈
      g.strokeStyle = 'rgba(0,229,255,.25)'; g.lineWidth = 2;
      for (let r = 40; r <= 120; r += 40) { g.beginPath(); g.arc(cx, 220, r, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      // 外框（霓虹）
      g.lineWidth = 4; g.strokeStyle = '#7c4dff'; g.shadowColor = '#7c4dff'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(4, H - 4); g.lineTo(4, 120); g.bezierCurveTo(4, 20, 120, 8, 200, 8); g.bezierCurveTo(300, 8, 356, 40, 356, 120); g.lineTo(356, H - 4); g.stroke();
      // 發射道
      g.strokeStyle = '#00e5ff'; g.shadowColor = '#00e5ff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(326, H - 4); g.lineTo(326, 110); g.stroke();
      g.shadowBlur = 0;
      // 彈簧
      const spTop = 446 + plunge * 22;
      g.fillStyle = '#9e9e9e'; for (let y = spTop; y < H - 6; y += 5) g.fillRect(laneX - 9, y, 18, 2);
      g.fillStyle = '#e0e0e0'; rr(laneX - 11, spTop - 8, 22, 8, 3); g.fill();
      // 釘子（彈跳器）
      for (let i = 0; i < PL_ROWS; i++) for (let j = 0; j <= i; j++) {
        const x = pegX(i, j), y = y0 + i * dy, c = COLORS[(i + j) % 4];
        const on = lit[i + ',' + j] && now - lit[i + ',' + j] < 260;
        g.shadowColor = c; g.shadowBlur = on ? 22 : 8;
        g.strokeStyle = c; g.lineWidth = on ? 3 : 2;
        g.beginPath(); g.arc(x, y, on ? PR + 4 : PR + 2, 0, Math.PI * 2); g.stroke();
        g.fillStyle = on ? '#fff' : '#cfd8dc'; g.beginPath(); g.arc(x, y, PR - 1, 0, Math.PI * 2); g.fill();
      }
      g.shadowBlur = 0;
      // 格子
      const hs = hist();
      for (let k = 0; k <= PL_ROWS; k++) {
        const x = slotX(k) - dx / 2 + 1, isTop = prizes[k] === top;
        const c = k === flash ? '#ffffff' : isTop ? '#ffd740' : COLORS[k % 4];
        g.shadowColor = c; g.shadowBlur = k === flash ? 24 : 6;
        g.strokeStyle = c; g.lineWidth = 2; rr(x, slotY, dx - 2, 40, 5); g.stroke();
        g.fillStyle = k === flash ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)'; g.fill();
        g.shadowBlur = 0;
        g.fillStyle = isTop ? '#ffd740' : '#fff'; g.font = 'bold 12px "Microsoft JhengHei UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(prizes[k]), slotX(k), slotY + 20);
      }
      // 下方：導軌與擋板
      g.strokeStyle = '#00e5ff'; g.lineWidth = 3; g.shadowColor = '#00e5ff'; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(4, 392); g.lineTo(70, 412); g.moveTo(326, 392); g.lineTo(252, 412); g.stroke();
      g.shadowBlur = 0;
      ['L', 'R'].forEach((k) => { const f = fl[k]; f.a += ((now < f.t ? 1 : 0) - f.a) * 0.45; });
      drawFlipper(70, 412, 1, 0.5 - fl.L.a * 0.9);
      drawFlipper(252, 412, -1, 0.5 - fl.R.a * 0.9);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '10px "Microsoft JhengHei UI", sans-serif'; g.textAlign = 'center';
      g.fillText('按擋板讓台子動起來！', cx, 462);
      // 珠子
      if (ball) {
        jitter *= 0.85;
        const bx = ball.x + jitter * Math.sin(now / 18), by = ball.y;
        g.fillStyle = 'rgba(0,229,255,.18)'; g.beginPath(); g.arc(bx, by, BR + 6, 0, Math.PI * 2); g.fill();
        const gr = g.createRadialGradient(bx - 3, by - 3, 1, bx, by, BR);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#cfd8dc'); gr.addColorStop(1, '#607d8b');
        g.fillStyle = gr; g.beginPath(); g.arc(bx, by, BR, 0, Math.PI * 2); g.fill();
      }
    }
    const loop = (now) => { if (sh.closed) return; draw(now); raf = requestAnimationFrame(loop); };
    function renderSide(last) {
      const hs = hist(), maxH = Math.max(1, ...hs), total = hs.reduce((a, b) => a + b, 0);
      sh.stage.querySelector('#pbBars').innerHTML = hs.map((h, k) => `<div class="pb-bar${k === flash ? ' on' : ''}"><i style="height:${Math.round(h / maxH * 100)}%"></i><b>${prizes[k]}</b><s>${h}</s></div>`).join('');
      sh.stage.querySelector('#pbBall').textContent = balls || 1;
      if (last !== undefined) {
        const el = sh.stage.querySelector('#pbScore'); let n = 0;
        const step = () => { n = Math.min(last, n + Math.max(1, Math.ceil(last / 12))); el.textContent = n; if (n < last) setTimeout(step, 40); };
        step();
      }
      sh.stage.querySelector('.pb-hl').textContent = `全班丟過 ${total} 顆：掉在哪裡？`;
    }
    const msg = (t) => { sh.stage.querySelector('#pbMsg').textContent = t; };
    const path = (fn, ms) => new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { if (sh.closed) { res(); return; } const p = Math.min(1, (now - t0) / ms); ball = fn(p); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
    const hop = (x0, y0_, x1, y1, ms, h) => path((p) => ({ x: x0 + (x1 - x0) * p, y: y0_ + (y1 - y0_) * p - Math.sin(p * Math.PI) * h }), ms);
    function flip(side) {
      fl[side].t = performance.now() + 140;
      Sound.flipper();
      if (ball && sh.busy) { flips++; jitter = 4; }
      table.classList.remove('shake'); void table.offsetWidth; table.classList.add('shake');
      // 隨便亮幾顆彈跳器（只是特效，不會改變結果）
      for (let n = 0; n < 3; n++) { const i = Math.floor(Math.random() * PL_ROWS); lit[i + ',' + Math.floor(Math.random() * (i + 1))] = performance.now(); }
    }
    async function launch() {
      if (sh.busy) return;
      if (!spend(student, 1, '彈珠台')) return;
      Research.decide(student, '彈珠台', '發射', { cost: price(), ev: plinkoEV() - price(), prize: top, note: '每一格機率固定（二項分布）；擋板只是好玩，不影響結果' });
      sh.setBusy(true); sh.sub(); FX.clear(sh.root); sh.hideResult();
      flash = -1; balls++; flips = 0; renderSide();
      msg('拉彈簧…');
      ball = { x: laneX, y: 434 };
      for (let i = 0; i <= 10; i++) { plunge = i / 10; await sleep(25); }
      Sound.launch(); msg('發射！快按擋板！');
      plunge = 0;
      await path((p) => ({ x: laneX, y: 434 - p * 330 }), 380);
      // 沿著上方弧線滑到中間
      await path((p) => { const a = p * Math.PI * 0.5; return { x: cx + Math.cos(a) * (laneX - cx), y: 104 - Math.sin(a) * 66 }; }, 420);
      await hop(cx, 38, cx, y0 - PR - BR, 300, 0);
      let j = 0;
      for (let i = 0; i < PL_ROWS; i++) {
        lit[i + ',' + j] = performance.now();
        Sound.bumper(i);
        const right = Math.random() < 0.5;
        const x0 = pegX(i, j), yA = y0 + i * dy - PR - BR;
        const slow = i >= PL_ROWS - 2 ? 1.8 : 1;
        if (i < PL_ROWS - 1) {
          const nj = j + (right ? 1 : 0);
          await hop(x0, yA, pegX(i + 1, nj), y0 + (i + 1) * dy - PR - BR, 190 * slow, 12);
          j = nj;
        } else {
          const k = j + (right ? 1 : 0);
          await hop(x0, yA, slotX(k), slotY + 20, 330 * slow, 12);
          j = k;
        }
        if (sh.closed) return;
      }
      Sound.clunk();
      const k = j, prize = prizes[k];
      hist()[k]++;
      flash = k;
      record(student, '彈珠台', 1, prize, { slot: k, flips });
      renderSide(prize);
      msg(prize >= top ? '大獎！！' : prize > price() ? '賺到了！' : '下一顆會更好？');
      sh.sub();
      if (prize >= top) FX.win(sh.root, 'big', sh.root.querySelector('.fx-behind'));
      else if (prize > price()) FX.win(sh.root, 'small', sh.root.querySelector('.fx-behind'));
      else if (prize === 0) FX.win(sh.root, 'miss'); else Sound.ticket();
      await sleep(700);
      sh.setBusy(false);
      const total = hist().reduce((a, b) => a + b, 0);
      sh.result(`得到 ${prize} 點`, prize > price(), [
        `用了 ${ticketWorth(1)}，拿到 ${prize} 點`,
        sh.stage.querySelector('.pb').classList.contains('narrow') ? `全班一共丟了 ${total} 顆` : `全班一共丟了 ${total} 顆，看看右邊的長條：中間是不是比較多？`
      ], [
        ...(student.zoneTickets > 0 ? [{ label: '再丟一顆', primary: true, onClick: () => { ball = null; msg('等待發射'); } }] : []),
        { label: '回遊樂場', onClick: () => sh.close() }
      ]);
    }
    sh.info('按「發射」放出珠子；珠子掉下來的時候，可以一直按左右擋板！');
    const acts = sh.actions(`<button class="go small pb-fl" data-fl="L">◀ 左擋板</button><button class="go pb-go" id="pbGo">發射！</button><button class="go small pb-fl" data-fl="R">右擋板 ▶</button>`);
    acts.querySelectorAll('[data-fl]').forEach((b) => { b.onpointerdown = (e) => { e.preventDefault(); flip(b.dataset.fl); }; });
    acts.querySelector('#pbGo').onclick = launch;
    cv.onpointerdown = (e) => { const r = cv.getBoundingClientRect(); flip(e.clientX - r.left < r.width / 2 ? 'L' : 'R'); };
    sh.onKey = (e) => {
      if (e.type !== 'keydown') return false;
      if (['ArrowLeft', 'z', 'Z', 'Shift'].includes(e.key)) { flip('L'); return true; }
      if (['ArrowRight', 'm', 'M', '/'].includes(e.key)) { flip('R'); return true; }
      return false;
    };
    sh.onSpace = launch;
    requestAnimationFrame(() => { size(); renderSide(); raf = requestAnimationFrame(loop); });
    const rs = () => size();
    window.addEventListener('resize', rs);
    sh.cleanup.push(() => { window.removeEventListener('resize', rs); cancelAnimationFrame(raf); });
  }

  // =====================================================================
  // 夾娃娃機：自己移動爪子；夾中的機率由老師設定；提醒「沉沒成本」
  // =====================================================================
  const PLUSH = ['🧸', '🐻', '🐰', '🦄', '🐥', '🐼', '🐸', '🐶'];
  // ---------- 收藏冊 ----------
  const plushKey = (type, gold) => (gold ? 'gold:' : '') + type;
  function bookHTML(s) {
    const own = s.plush || {};
    const th = window.ClawModel ? ClawModel.thumbs() : null;
    const types = window.ClawModel ? ClawModel.PLUSH_TYPES : [];
    const cell = (tp, gold) => {
      const k = plushKey(tp, gold), n = own[k] || 0, src = th && th[k];
      return `<div class="bk-c${n ? ' got' : ''}${gold ? ' gold' : ''}">${src ? `<img src="${src}" alt="">` : '<span class="bk-q">🧸</span>'}<b>${n ? (gold ? '金' : '') + ClawModel.PLUSH_NAMES[tp] : '？？？'}</b>${n > 1 ? `<i>×${n}</i>` : ''}</div>`;
    };
    const got = types.filter((t) => own[t]).length, gotG = types.filter((t) => own[plushKey(t, true)]).length;
    return `<div class="bk"><div class="bk-h">📒 ${esc(s.name)}的收藏冊 <span>一般 ${got}／${types.length}・金色 ${gotG}／${types.length}</span></div>
      <div class="bk-g">${types.map((t) => cell(t, false)).join('')}</div>
      <div class="bk-sub">✨ 金色稀有娃娃</div>
      <div class="bk-g">${types.map((t) => cell(t, true)).join('')}</div></div>`;
  }
  function openBook(s, host) {
    const ov = document.createElement('div');
    ov.className = 'bk-ov';
    ov.innerHTML = bookHTML(s) + '<button class="go small bk-x">關閉</button>';
    host.appendChild(ov);
    ov.querySelector('.bk-x').onclick = () => ov.remove();
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    Sound.tick();
  }

  // ---------- 3D 夾娃娃機 ----------
  const webglOK = (() => { let v = null; return () => { if (v !== null) return v; try { const c = document.createElement('canvas'); v = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { v = false; } return v; }; })();
  function claw(student, back) {
    if (!window.THREE || !window.ClawModel || !webglOK()) return claw2d(student, back);
    const sh = shell({ student, icon: '🧸', title: '夾娃娃機', bg: '#120a2a', back });
    sh.root.classList.add('c3');
    sh.stage.innerHTML = `<div class="c3-wrap"><canvas class="c3-cv"></canvas>
      <div class="c3-hud"><button class="c3-b" id="c3View">👀 看側邊</button><button class="c3-b" id="c3Book">📒 收藏冊</button></div>
      <div class="c3-tip" id="c3Tip"></div></div>`;
    const wrap = sh.stage.querySelector('.c3-wrap'), cv = wrap.querySelector('canvas'), tip = wrap.querySelector('#c3Tip');
    let M;
    try { M = ClawModel.create(cv, { gold: 1 }); } catch (e) { console.error(e); sh.close(true); return claw2d(student, back); }
    const st = M.state;
    sh.root.__claw = M; // 方便測試
    const TOP = st.y;
    const HOME = { x: 0.1, z: 0.05 };
    const v = { x: 0, z: 0 }, keys = {};
    let tries = 0, failRun = 0, raf = 0, last = performance.now(), side = false, view = null, aimed = null, closed = false;
    const goldGrip = () => { const g = Number(A().clawGoldGrip); return Number.isFinite(g) ? Math.max(0, Math.min(100, g)) : 15; };
    const prizeOf = (p) => (p && p.userData.gold ? Math.max(1, Number(A().clawGoldPrize) || 100) : Math.max(1, Number(A().clawPrize) || 30));
    // 鏡頭
    const V = {
      player: () => { const a = cv.clientWidth / Math.max(1, cv.clientHeight); return { p: [0, 1.52, a < 1.15 ? 1.95 : 1.68], t: [0, 1.02, 0.05], fov: a < 1.15 ? 46 : 41 }; },
      side: () => ({ p: [1.65, 1.38, 0.0], t: [0, 1.1, 0], fov: 42 }),
      door: () => ({ p: [-0.12, 0.6, 1.4], t: [-0.3, 0.33, 0.42], fov: 34 })
    };
    let cam = V.player();
    const camTo = (name, ms = 650) => new Promise((res) => {
      const to = V[name](), from = { p: [...cam.p], t: [...cam.t], fov: cam.fov }, t0 = performance.now();
      view = name;
      const step = (now) => {
        if (closed) { res(); return; }
        let k = Math.min(1, (now - t0) / ms); k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        cam = { p: from.p.map((x, i) => x + (to.p[i] - x) * k), t: from.t.map((x, i) => x + (to.t[i] - x) * k), fov: from.fov + (to.fov - from.fov) * k };
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    const resize = () => { const w = wrap.clientWidth, h = wrap.clientHeight; if (w && h) { M.resize(w, h); if (view === 'player' || !view) cam = V.player(); } };
    const ro = new ResizeObserver(resize); ro.observe(wrap);
    // 找爪子正下方的娃娃（優先最上面那隻）
    function findAim() {
      let best = null;
      M.prizes.forEach((p) => {
        const d = Math.hypot(p.position.x - st.x, p.position.z - st.z);
        if (d < 0.075 * p.scale.x && (!best || p.position.y > best.position.y)) best = p;
      });
      return best;
    }
    const restY = (x, z, self) => (M.prizes.some((q) => q !== self && q.position.y < M.FLOOR + 0.03 && Math.hypot(q.position.x - x, q.position.z - z) < 0.12) ? M.FLOOR + 0.09 : M.FLOOR);
    const loop = (now) => {
      if (closed) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), kz = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
      let mx = kx || v.x, mz = kz || -v.z;
      if (sh.busy) { mx = 0; mz = 0; }
      // 側面視角時，搖桿的左右變成前後（跟著鏡頭轉）
      const dx = side ? mz : mx, dz = side ? -mx : mz;
      if (dx || dz) {
        st.x = Math.max(-M.LIM.x, Math.min(M.LIM.x, st.x + dx * 0.36 * dt));
        st.z = Math.max(-M.LIM.z, Math.min(M.LIM.z, st.z + dz * 0.36 * dt));
        if (!st.moving) { st.moving = true; }
      } else st.moving = false;
      st.vx = dx; st.vz = -dz;
      // 爪子移動時輕輕晃
      M.claw.rotation.z += ((-dx * 0.12) - M.claw.rotation.z) * 0.08;
      M.claw.rotation.x += ((dz * 0.12) - M.claw.rotation.x) * 0.08;
      if (!sh.busy) {
        aimed = findAim();
        M.aim.material.color.set(aimed ? (aimed.userData.gold ? 0xffd54f : 0x69f0ae) : 0xffffff);
        M.aim.position.y = aimed ? aimed.position.y + 0.3 * aimed.scale.x : M.FLOOR + 0.004;
        M.aim.visible = true;
        tip.textContent = aimed ? (aimed.userData.gold ? '✨ 對準金色娃娃了！' : '✅ 對準了！按「夾」') : '';
        tip.className = 'c3-tip' + (aimed ? ' on' : '') + (aimed && aimed.userData.gold ? ' gold' : '');
      } else { M.aim.visible = false; tip.textContent = ''; tip.className = 'c3-tip'; }
      M.setViewVec(cam.p, cam.t, cam.fov);
      M.render(now / 1000);
      if (typeof placeHints === 'function') placeHints();
      raf = requestAnimationFrame(loop);
    };
    const tw = (obj, key, to, ms, ease) => new Promise((res) => {
      const from = obj[key], t0 = performance.now();
      const step = (now) => {
        if (closed) { res(); return; }
        let p = Math.min(1, (now - t0) / ms);
        p = ease === 'in' ? p * p : ease === 'out' ? 1 - (1 - p) * (1 - p) : p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        obj[key] = from + (to - from) * p;
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    // 娃娃掉下去（簡單的重力＋彈一下）
    const fall = (p, toY, ms = 520) => new Promise((res) => {
      const y0 = p.position.y, rx = p.rotation.x, rz = p.rotation.z, spin = (Math.random() - 0.5) * 1.2, t0 = performance.now();
      const step = (now) => {
        if (closed) { res(); return; }
        const k = Math.min(1, (now - t0) / ms);
        const b = k < 0.75 ? Math.pow(k / 0.75, 2) : 1 - Math.sin((k - 0.75) / 0.25 * Math.PI) * 0.12;
        p.position.y = y0 + (toY - y0) * b;
        p.rotation.x = rx + spin * k * 0.6; p.rotation.z = rz + spin * k * 0.4;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    function spawnPrize() {
      const types = ClawModel.PLUSH_TYPES;
      let x = 0, z = 0, ok = false;
      for (let n = 0; n < 40 && !ok; n++) {
        x = -0.3 + Math.random() * 0.68; z = -0.3 + Math.random() * 0.6;
        ok = !(x < M.chute.x + M.chute.s / 2 + 0.07 && z > M.chute.z - M.chute.s / 2 - 0.07) && !M.prizes.some((q) => Math.hypot(q.position.x - x, q.position.z - z) < 0.15);
      }
      const y = restY(x, z);
      const p = M.addPrize(types[Math.floor(Math.random() * types.length)], x, z, y + 0.5, Math.random() * 6, (Math.random() - 0.5) * 0.3, Math.random() < 0.08);
      fall(p, y, 600);
    }
    async function drop() {
      if (sh.busy) return;
      if (!spend(student, 1, '夾娃娃機')) return;
      tries++;
      const target = findAim();
      const gp = target ? (target.userData.gold ? goldGrip() : Math.max(0, Math.min(100, grip0()))) : 0;
      Research.decide(student, '夾娃娃機', target && target.userData.gold ? '夾（金色娃娃）' : '夾', { p: gp, prize: prizeOf(target), cost: price(), round: tries, sunk: failRun, note: target ? (target.userData.gold ? '對準金色娃娃' : '爪子有對準娃娃') : '爪子沒對準' });
      sh.setBusy(true); sh.sub(); sh.hideResult(); FX.clear(sh.root);
      v.x = v.z = 0;
      // 3D 按鈕按下去
      M.btn.position.y -= 0.014; setTimeout(() => { M.btn.position.y += 0.014; }, 220);
      Sound.lever();
      await tw(st, 'open', 1, 300);
      const downY = target ? target.position.y + 0.27 * target.scale.x : M.FLOOR + 0.24;
      await tw(st, 'y', downY, 1300, 'in');
      await tw(st, 'open', 0, 380);
      Sound.clunk();
      const success = !!target && Math.random() * 100 < gp;
      if (target) M.heldSlot.attach(target);
      const stopWait = target ? FX.suspense(sh.root, 1500) : () => {};
      let prize = 0;
      if (target && !success) {
        await tw(st, 'y', downY + 0.18 + Math.random() * 0.2, 900, 'out');
        stopWait();
        // 爪子沒抓緊，娃娃滑下去
        tw(st, 'open', 0.45, 160);
        M.prizeGroup.attach(target);
        Sound.zero();
        await fall(target, restY(target.position.x, target.position.z, target));
        await tw(st, 'y', TOP, 700);
        await tw(st, 'open', 0.25, 200);
      } else if (success) {
        await tw(st, 'y', TOP, 1300, 'out');
        stopWait();
        await Promise.all([tw(st, 'x', M.chute.x, 1300), tw(st, 'z', M.chute.z, 1300)]);
        await tw(st, 'open', 1, 260);
        M.prizeGroup.attach(target);
        Sound.clunk();
        await fall(target, M.FLOOR - 0.45, 520);
        target.visible = false;
        M.prizeGroup.remove(target);
        M.prizes.splice(M.prizes.indexOf(target), 1);
        // 鏡頭拉到取物口，擋板打開，娃娃出現
        await camTo('door', 700);
        const won = ClawModel.plush(target.userData.type, target.userData.gold);
        won.scale.setScalar(0.78); won.rotation.set(-0.1, 0.25, 0); won.position.set(0, 0, 0.02);
        M.prizeSlot.add(won);
        await tw(M.flapPivot.rotation, 'x', -1.1, 350, 'out');
        prize = prizeOf(target);
        const k = plushKey(target.userData.type, target.userData.gold);
        if (!student.plush || typeof student.plush !== 'object') student.plush = {};
        const isNew = !student.plush[k];
        student.plush[k] = (student.plush[k] || 0) + 1;
        FX.win(sh.root, 'big', sh.root.querySelector('.fx-behind'));
        record(student, '夾娃娃機', 1, prize, { tries, plush: (target.userData.gold ? '金' : '') + ClawModel.PLUSH_NAMES[target.userData.type], newPlush: isNew });
        failRun = 0;
        sh.sub();
        await sleep(600);
        sh.setBusy(false);
        const name = (target.userData.gold ? '✨金色' : '') + ClawModel.PLUSH_NAMES[target.userData.type];
        sh.result(`🎉 夾到${name}！`, true, [
          `得到 ${prize} 點${isNew ? '，收藏冊多了一隻新朋友！' : ''}`,
          `在這台一共用了 ${ticketWorth(tries)}`
        ], [
          ...(student.zoneTickets > 0 ? [{ label: '再夾一次', primary: true, onClick: () => reset(won) }] : []),
          { label: '📒 看收藏冊', onClick: () => { reset(won); openBook(student, sh.root); } },
          { label: '不玩了', onClick: () => sh.close() }
        ]);
        spawnPrize();
        return;
      } else {
        await tw(st, 'y', TOP, 1100, 'out');
        Sound.zero();
      }
      record(student, '夾娃娃機', 1, 0, { tries });
      failRun += 1;
      sh.sub();
      await sleep(300);
      sh.setBusy(false);
      sh.result('沒夾到…', false, [
        target ? '差一點…娃娃滑下去了' : '爪子下面沒有娃娃（對準時，娃娃頭上會出現綠色圈圈）',
        `在這台已經用了 ${ticketWorth(tries)}`,
        '用掉的拿不回來；下一次夾中的機率還是一樣，不會因為前面失敗就比較容易。'
      ], [
        ...(student.zoneTickets > 0 ? [{ label: '再夾一次', primary: true, onClick: () => {} }] : []),
        { label: '不玩了', onClick: () => sh.close() }
      ]);
    }
    async function reset(won) {
      tw(M.flapPivot.rotation, 'x', 0, 300);
      if (won) setTimeout(() => M.prizeSlot.remove(won), 300);
      Promise.all([tw(st, 'x', HOME.x, 900), tw(st, 'z', HOME.z, 900), tw(st, 'open', 0.25, 300)]);
      await camTo(side ? 'side' : 'player', 650);
    }
    // 操作
    // 直接操作機台上的 3D 搖桿和按鈕（沒有另外的操作區）
    sh.info(''); sh.actions('');
    sh.root.classList.add('c3-full');
    const hintStick = document.createElement('div'); hintStick.className = 'c3-hint stick'; hintStick.innerHTML = '<b>⬅ ⬆ ➡</b>拖曳搖桿移動爪子';
    const hintBtn = document.createElement('div'); hintBtn.className = 'c3-hint btn'; hintBtn.innerHTML = '<b>👇</b>按這裡夾！';
    wrap.append(hintStick, hintBtn);
    let usedStick = false, usedBtn = false;
    const scr = (obj, local) => {
      const p = new window.THREE.Vector3(...local); obj.localToWorld(p); p.project(M.camera);
      return { x: (p.x + 1) / 2 * cv.clientWidth, y: (1 - p.y) / 2 * cv.clientHeight, ok: p.z < 1 };
    };
    const stickPos = () => scr(M.stick, [0, 0.14, 0]);
    const stickBasePos = () => scr(M.stick, [0, 0, 0]);
    const btnPos = () => scr(M.btn, [0, 0.02, 0]);
    const reach = () => Math.max(45, cv.clientHeight * 0.085);
    let jp = null, jStart = null;
    const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) < d;
    cv.addEventListener('pointerdown', (e) => {
      const q = local(e);
      if (near(q, stickPos(), reach() * 0.9) || near(q, stickBasePos(), reach() * 0.7)) {
        if (sh.busy) return;
        jp = e.pointerId; jStart = stickBasePos(); cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
        usedStick = true; Sound.tick();
        moveStick(q); e.preventDefault(); return;
      }
      if (near(q, btnPos(), reach() * 0.85)) { e.preventDefault(); usedBtn = true; drop(); }
    });
    const moveStick = (q) => {
      const R = reach();
      let dx = (q.x - jStart.x) / R, dy = (q.y - jStart.y + R * 0.6) / R; // 抓的是球（在底座上方），所以往下補一點
      const d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d; }
      v.x = Math.abs(dx) > 0.15 ? dx : 0;
      v.z = Math.abs(dy) > 0.15 ? -dy : 0;
    };
    cv.addEventListener('pointermove', (e) => {
      const q = local(e);
      if (jp === e.pointerId) { moveStick(q); return; }
      if (sh.busy) { cv.style.cursor = ''; return; }
      cv.style.cursor = near(q, stickPos(), reach() * 0.9) || near(q, stickBasePos(), reach() * 0.7) ? 'grab' : near(q, btnPos(), reach() * 0.85) ? 'pointer' : '';
    });
    const release = (e) => { if (jp !== e.pointerId) return; jp = null; v.x = 0; v.z = 0; cv.style.cursor = ''; };
    cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
    // 提示泡泡跟著 3D 搖桿和按鈕跑
    const placeHints = () => {
      const a = stickPos(), b = btnPos(), show = !sh.busy && view !== 'door';
      hintStick.style.left = a.x + 'px'; hintStick.style.top = (a.y - reach() * 0.9) + 'px';
      hintBtn.style.left = b.x + 'px'; hintBtn.style.top = (b.y - reach() * 0.9) + 'px';
      hintStick.classList.toggle('on', show && !usedStick);
      hintBtn.classList.toggle('on', show && usedStick && !usedBtn);
    };
    sh.cleanup.push(() => { hintStick.remove(); hintBtn.remove(); });
    const viewBtn = wrap.querySelector('#c3View');
    viewBtn.onclick = () => { if (sh.busy) return; side = !side; viewBtn.textContent = side ? '🎮 回正面' : '👀 看側邊'; camTo(side ? 'side' : 'player'); Sound.tick(); };
    wrap.querySelector('#c3Book').onclick = () => openBook(student, sh.root);
    const K = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
    sh.onKey = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (K.includes(k)) { keys[k] = e.type === 'keydown'; e.preventDefault(); return true; }
      if (k === 'v' && e.type === 'keydown') { viewBtn.click(); return true; }
      return false;
    };
    const ku = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k in keys) keys[k] = false; };
    window.addEventListener('keyup', ku);
    sh.onSpace = drop;
    sh.cleanup.push(() => {
      closed = true; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keyup', ku);
      try { M.renderer.dispose(); M.renderer.forceContextLoss(); } catch (e) { /* 已經關了 */ }
    });
    requestAnimationFrame(() => { resize(); view = 'player'; cam = V.player(); raf = requestAnimationFrame(loop); });
  }

  // 沒有 3D（WebGL）時用的平面版
  function claw2d(student, back) {
    const sh = shell({ student, icon: '🧸', title: '夾娃娃機', bg: '#3a1030', back });
    const bulbs = Array.from({ length: 13 }, (_, i) => `<i style="--d:${(i % 2) * 0.4}s;--c:${['#fff176', '#ff80ab', '#80d8ff'][i % 3]}"></i>`).join('');
    const stars = (n) => Array.from({ length: n }, (_, i) => `<i style="--d:${(i % 3) * 0.3}s;--c:${['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff'][i % 4]}">★</i>`).join('');
    sh.stage.innerHTML = `
      <div class="ck ck3d">
        <div class="ck-top"><div class="ck-bulbs">${bulbs}</div><div class="ck-title"><span>夾</span><span>娃</span><span>娃</span><span>機</span></div></div>
        <div class="ck-body">
          <div class="ck-post">${stars(6)}</div>
          <div class="ck-glass" id="cmBox"><canvas class="ck-cv"></canvas></div>
          <div class="ck-post">${stars(6)}</div>
        </div>
        <div class="ck-panel">
          <div class="ck-out" id="ckOut"><span>出口</span></div>
          <div class="ck-deck">
            <div class="ck-stick" id="ckStick"><i></i></div>
            <span class="ck-btn" id="ckBtn"></span><span class="ck-btn b2"></span><span class="ck-btn b3"></span>
            <div class="ck-coin">🎟</div>
          </div>
        </div>
      </div>`;
    const box = sh.stage.querySelector('#cmBox');
    const cv = box.querySelector('canvas');
    const stickI = sh.stage.querySelector('#ckStick i');
    const out = sh.stage.querySelector('#ckOut');
    // ---------- 3D 世界：x 左右（-1～1）、y 高度（0～1.7）、z 前後（0＝玻璃，1.4＝最裡面） ----------
    const BX = 1, BY = 1.25, BZ = 1.4, FLOOR = 0.16, TOPY = 1.02, CHUTE = { x0: -1, x1: -0.58, z0: 0, z1: 0.42, h: 0.5 };
    const CAM = { y: 1.85, z: -1.75 }, LOOK = { y: 0.4, z: 0.72 };
    const pitch = Math.atan2(CAM.y - LOOK.y, LOOK.z - CAM.z), cp = Math.cos(pitch), sp = Math.sin(pitch);
    let F = 300, OX = 0, OY = 0, Wc = 400, Hc = 400, g;
    const P = (x, y, z) => { const dy = y - CAM.y, dz = z - CAM.z; const cz = dz * cp - dy * sp, cy = dy * cp + dz * sp; return { x: OX + F * x / cz, y: OY - F * cy / cz, s: F / cz }; };
    const BALLC = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#00acc1', '#f06292', '#ffffff'];
    const inChute = (x, z, m = 0) => x < CHUTE.x1 + m && z < CHUTE.z1 + m;
    const balls = [];
    while (balls.length < 230) {
      const x = -0.95 + Math.random() * 1.9, z = 0.04 + Math.random() * 1.32;
      if (inChute(x, z, 0.04)) continue;
      balls.push({ x, z, y: 0.03 + Math.random() * 0.1, c: BALLC[Math.floor(Math.random() * BALLC.length)], r: 0.06 + Math.random() * 0.025 });
    }
    balls.sort((a, b) => b.z - a.z || a.y - b.y);
    const newPrize = () => {
      for (let n = 0; n < 50; n++) {
        const p = { x: -0.4 + Math.random() * 1.25, z: 0.15 + Math.random() * 1.1, e: PLUSH[Math.floor(Math.random() * PLUSH.length)] };
        if (!prizes.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.3)) return p;
      }
      return { x: Math.random() * 0.8, z: 0.3 + Math.random() * 0.9, e: PLUSH[0] };
    };
    const prizes = [];
    for (let i = 0; i < 7; i++) prizes.push(newPrize());
    const HOME = { x: 0.2, z: 0.35 };
    const c = { x: HOME.x, z: HOME.z, y: TOPY, open: 0.3, held: null, heldY: 0, fall: null, sway: 0 };
    const v = { x: 0, z: 0 }, keys = {};
    let tries = 0, failRun = 0, raf = 0, last = performance.now();
    const aligned = () => { let best = -1, bd = 0.17; prizes.forEach((p, i) => { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = i; } }); return best; };
    function size() {
      const r = box.getBoundingClientRect();
      Wc = Math.max(100, r.width); Hc = Math.max(100, r.height);
      const dpr = window.devicePixelRatio || 1;
      cv.width = Wc * dpr; cv.height = Hc * dpr; cv.style.width = Wc + 'px'; cv.style.height = Hc + 'px';
      g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 讓整個箱子剛好塞進畫面
      F = 1; OX = 0; OY = 0;
      const pts = [];
      [-BX, BX].forEach((x) => { pts.push(P(x, 0, 0), P(x, 0, BZ), P(x, BY, BZ), P(x, 0.55, 0)); });
      const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
      F = Math.min(Wc * 0.98 / (maxX - minX), Hc * 0.96 / (maxY - minY));
      OX = Wc / 2 - F * (minX + maxX) / 2; OY = Hc / 2 - F * (minY + maxY) / 2;
    }
    function quad(a, b, cc, d, fill, stroke) {
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(cc.x, cc.y); g.lineTo(d.x, d.y); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.stroke(); }
    }
    function drawBall(b) {
      const p = P(b.x, b.y + b.r, b.z), r = b.r * p.s;
      const gr = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, b.c); gr.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    }
    function drawPrize(p, y, alpha) {
      const q = P(p.x, y, p.z), fs = 0.42 * q.s;
      g.globalAlpha = alpha == null ? 1 : alpha;
      g.fillStyle = '#000';
      g.font = `${fs}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillText(p.e, q.x, q.y + fs * 0.12);
      g.globalAlpha = 1;
    }
    function drawClaw() {
      const top = P(c.x, BY - 0.04, c.z), hub = P(c.x, c.y, c.z), s = hub.s;
      // 繩子
      g.strokeStyle = '#e0e0e0'; g.lineWidth = Math.max(1.5, 0.018 * s); g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(hub.x, hub.y); g.stroke();
      const sw = Math.sin(c.sway) * 0.05 * s;
      const L = 0.24 * s, o = 0.05 + c.open * 0.11;
      const prong = (dx, dz, back) => {
        const tip = P(c.x + dx * o, c.y - 0.24, c.z + dz * o);
        const mid = P(c.x + dx * (o + 0.05), c.y - 0.1, c.z + dz * (o + 0.05));
        g.strokeStyle = back ? '#c79a00' : '#fbc02d'; g.lineWidth = 0.05 * s; g.lineCap = 'round';
        g.beginPath(); g.moveTo(hub.x + sw, hub.y); g.quadraticCurveTo(mid.x + sw, mid.y, tip.x + sw, tip.y); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.015 * s;
        g.beginPath(); g.moveTo(hub.x + sw, hub.y); g.quadraticCurveTo(mid.x + sw, mid.y, tip.x + sw, tip.y); g.stroke();
      };
      prong(0, 1, true);                 // 後面那一支
      if (c.held) drawPrize({ x: c.x, z: c.z, e: c.held }, c.y - 0.3 - c.heldY);
      prong(-0.87, -0.5); prong(0.87, -0.5);
      const gr = g.createRadialGradient(hub.x - 0.02 * s + sw, hub.y - 0.03 * s, 1, hub.x + sw, hub.y, 0.085 * s);
      gr.addColorStop(0, '#fff9c4'); gr.addColorStop(0.5, '#fbc02d'); gr.addColorStop(1, '#e65100');
      g.fillStyle = gr; g.beginPath(); g.ellipse(hub.x + sw, hub.y, 0.085 * s, 0.06 * s, 0, 0, Math.PI * 2); g.fill();
      g.lineCap = 'butt';
    }
    function draw(now) {
      g.clearRect(0, 0, Wc, Hc);
      const C = (x, y, z) => P(x, y, z);
      // 內側：後牆、左右牆、地板
      const bg = g.createLinearGradient(0, 0, 0, Hc); bg.addColorStop(0, '#2a1a5e'); bg.addColorStop(1, '#4b2c8f');
      quad(C(-BX, 0, BZ), C(BX, 0, BZ), C(BX, BY, BZ), C(-BX, BY, BZ), bg);
      quad(C(-BX, 0, 0), C(-BX, 0, BZ), C(-BX, BY, BZ), C(-BX, BY, 0), 'rgba(60,30,110,.95)');
      quad(C(BX, 0, 0), C(BX, 0, BZ), C(BX, BY, BZ), C(BX, BY, 0), 'rgba(60,30,110,.95)');
      quad(C(-BX, 0, 0), C(BX, 0, 0), C(BX, 0, BZ), C(-BX, 0, BZ), '#5b3a9e');
      // 後牆的小燈
      for (let i = 0; i < 9; i++) { const p = C(-0.9 + i * 0.225, BY - 0.12, BZ); g.fillStyle = `hsla(${(i * 40 + now / 10) % 360},90%,70%,${0.5 + 0.5 * Math.sin(now / 200 + i)})`; g.beginPath(); g.arc(p.x, p.y, 0.025 * p.s, 0, Math.PI * 2); g.fill(); }
      // 上方軌道：左右兩條（前後方向）＋一條會前後移動的橫桿
      g.lineWidth = 3; g.strokeStyle = '#fbc02d';
      [[-BX + 0.03], [BX - 0.03]].forEach(([x]) => { const a = C(x, BY - 0.03, 0.02), b = C(x, BY - 0.03, BZ - 0.02); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
      { const a = C(-BX + 0.03, BY - 0.04, c.z), b = C(BX - 0.03, BY - 0.04, c.z); g.lineWidth = Math.max(3, 0.04 * a.s); g.strokeStyle = '#f9a825'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      { const k = C(c.x, BY - 0.04, c.z); g.fillStyle = '#fdd835'; g.fillRect(k.x - 0.07 * k.s, k.y - 0.04 * k.s, 0.14 * k.s, 0.08 * k.s); }
      // 珠子堆
      balls.forEach(drawBall);
      // 出口（透明的方筒）
      quad(C(CHUTE.x1, 0, CHUTE.z0), C(CHUTE.x1, 0, CHUTE.z1), C(CHUTE.x1, CHUTE.h, CHUTE.z1), C(CHUTE.x1, CHUTE.h, CHUTE.z0), 'rgba(255,255,255,.18)', 'rgba(255,255,255,.8)');
      quad(C(CHUTE.x0, 0, CHUTE.z1), C(CHUTE.x1, 0, CHUTE.z1), C(CHUTE.x1, CHUTE.h, CHUTE.z1), C(CHUTE.x0, CHUTE.h, CHUTE.z1), 'rgba(255,255,255,.12)', 'rgba(255,255,255,.8)');
      quad(C(CHUTE.x0, CHUTE.h, CHUTE.z0), C(CHUTE.x1, CHUTE.h, CHUTE.z0), C(CHUTE.x1, CHUTE.h, CHUTE.z1), C(CHUTE.x0, CHUTE.h, CHUTE.z1), 'rgba(10,0,30,.55)', '#fff');
      quad(C(CHUTE.x0, 0, CHUTE.z0), C(CHUTE.x1, 0, CHUTE.z0), C(CHUTE.x1, CHUTE.h, CHUTE.z0), C(CHUTE.x0, CHUTE.h, CHUTE.z0), 'rgba(255,255,255,.16)', 'rgba(255,255,255,.9)');
      { const t = C((CHUTE.x0 + CHUTE.x1) / 2, CHUTE.h * 0.45, 0); g.fillStyle = '#fff'; g.font = `bold ${Math.round(0.1 * t.s)}px "Microsoft JhengHei UI",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('出口', t.x, t.y); }
      // 爪子正下方的影子（看得出前後）
      const ai = sh.busy ? -1 : aligned();
      { const p = C(c.x, FLOOR + 0.06, c.z); g.fillStyle = ai >= 0 ? 'rgba(105,240,174,.5)' : 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(p.x, p.y, 0.14 * p.s, 0.06 * p.s, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = ai >= 0 ? '#69f0ae' : 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); }
      // 娃娃和爪子：遠的先畫
      const items = prizes.map((p) => ({ z: p.z, d: () => drawPrize(p, FLOOR) }));
      if (c.fall) items.push({ z: c.fall.z, d: () => drawPrize(c.fall, c.fall.y, c.fall.a) });
      items.push({ z: c.z - 0.001, d: () => {
        if (!sh.busy) { const h = P(c.x, c.y - 0.26, c.z), f = P(c.x, FLOOR + 0.06, c.z); g.strokeStyle = ai >= 0 ? 'rgba(105,240,174,.7)' : 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(f.x, f.y); g.stroke(); g.setLineDash([]); }
        drawClaw();
      } });
      items.sort((a, b) => b.z - a.z).forEach((it) => it.d());
      // 前面的玻璃反光
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.beginPath(); g.moveTo(Wc * 0.05, 0); g.lineTo(Wc * 0.2, 0); g.lineTo(Wc * 0.02, Hc); g.lineTo(0, Hc); g.lineTo(0, Hc * 0.2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(Wc * 0.26, 0); g.lineTo(Wc * 0.3, 0); g.lineTo(Wc * 0.12, Hc); g.lineTo(Wc * 0.08, Hc); g.closePath(); g.fill();
    }
    const loop = (now) => {
      if (sh.closed) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), kz = (keys.ArrowUp || keys.w ? 1 : 0) - (keys.ArrowDown || keys.s ? 1 : 0);
      const mx = kx || v.x, mz = kz || v.z;
      if ((mx || mz) && !sh.busy) {
        c.x = Math.max(-0.88, Math.min(0.88, c.x + mx * 0.75 * dt));
        c.z = Math.max(0.1, Math.min(BZ - 0.12, c.z + mz * 0.75 * dt));
        c.sway += dt * 9;
      } else c.sway *= 0.9;
      stickI.style.transform = sh.busy ? '' : `rotate(${mx * 25}deg) scaleY(${1 - mz * 0.3})`;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const tween = (obj, key, to, ms, ease) => new Promise((res) => {
      const from = obj[key], t0 = performance.now();
      const step = (now) => { if (sh.closed) { res(); return; } let p = Math.min(1, (now - t0) / ms); p = ease === 'in' ? p * p : ease === 'out' ? 1 - (1 - p) * (1 - p) : p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; obj[key] = from + (to - from) * p; if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
    const moveTo = (x, z, ms) => Promise.all([tween(c, 'x', x, ms), tween(c, 'z', z, ms)]);
    const drop = async () => {
      if (sh.busy) return;
      if (!spend(student, 1, '夾娃娃機')) return;
      tries++;
      const ai = aligned();
      const gp = Math.max(0, Math.min(100, grip0()));
      Research.decide(student, '夾娃娃機', '夾', { p: ai >= 0 ? gp : 0, prize: Math.max(1, Number(A().clawPrize) || 30), cost: price(), round: tries, sunk: failRun, note: ai >= 0 ? '爪子有對準娃娃' : '爪子沒對準' });
      sh.setBusy(true); sh.sub(); sh.hideResult(); FX.clear(sh.root);
      v.x = v.z = 0;
      out.classList.remove('has'); out.innerHTML = '<span>出口</span>';
      sh.stage.querySelector('#ckBtn').classList.add('down'); setTimeout(() => { const b = sh.stage.querySelector('#ckBtn'); if (b) b.classList.remove('down'); }, 200);
      Sound.lever();
      await tween(c, 'open', 1, 300);
      await tween(c, 'y', FLOOR + 0.5, 1100, 'in');
      Sound.clunk();
      await tween(c, 'open', 0, 320);
      const idx = ai;
      const success = idx >= 0 && Math.random() * 100 < gp;
      let p0 = null;
      if (idx >= 0) { p0 = prizes[idx]; prizes.splice(idx, 1); c.held = p0.e; }
      const stopWait = idx >= 0 ? FX.suspense(sh.root, 1400) : () => {};
      await tween(c, 'y', success || idx < 0 ? TOPY : 0.78, 1400, 'out');
      stopWait();
      let prize = 0;
      if (idx >= 0 && !success) {
        // 爪子一鬆，娃娃掉回去
        c.open = 0.5; Sound.zero();
        c.fall = { x: c.x, z: c.z, e: c.held, y: c.y - 0.3, a: 1 }; c.held = null;
        await tween(c.fall, 'y', FLOOR, 450, 'in');
        const back2 = { x: Math.max(-0.4, Math.min(0.85, p0.x + (Math.random() * 0.2 - 0.1))), z: Math.max(0.15, Math.min(1.25, p0.z + (Math.random() * 0.2 - 0.1))), e: p0.e };
        prizes.push(back2); c.fall = null;
        await tween(c, 'open', 0.3, 200);
        await tween(c, 'y', TOPY, 500);
      } else if (success) {
        await moveTo(-0.79, 0.21, 1300);
        await tween(c, 'open', 1, 250);
        Sound.clunk();
        c.fall = { x: c.x, z: c.z, e: c.held, y: c.y - 0.3, a: 1 }; c.held = null;
        await Promise.all([tween(c.fall, 'y', 0, 500, 'in'), tween(c.fall, 'a', 0.2, 500)]);
        c.fall = null;
        out.innerHTML = `<b>${p0.e}</b>`; out.classList.add('has');
        prize = Math.max(1, Number(A().clawPrize) || 30);
        prizes.push(newPrize());
        FX.win(sh.root, 'big', sh.root.querySelector('.fx-behind'));
        await tween(c, 'open', 0.3, 200);
        moveTo(HOME.x, HOME.z, 1200);
      } else {
        Sound.zero();
      }
      record(student, '夾娃娃機', 1, prize, { tries });
      failRun = prize ? 0 : failRun + 1;
      sh.sub();
      await sleep(400);
      sh.setBusy(false);
      const lines = prize
        ? [`夾到了！得到 ${prize} 點`, `在這台一共用了 ${ticketWorth(tries)}`]
        : [idx >= 0 ? '差一點…娃娃掉下來了' : '爪子下面沒有娃娃（看看地上的影子有沒有變綠）', `在這台已經用了 ${ticketWorth(tries)}`, '用掉的拿不回來；下一次夾中的機率還是一樣，不會因為前面失敗就比較容易。'];
      sh.result(prize ? '🎉 夾到了！' : '沒夾到…', !!prize, lines, [
        ...(student.zoneTickets > 0 ? [{ label: '再夾一次', primary: true, onClick: () => {} }] : []),
        { label: '不玩了', onClick: () => sh.close() }
      ]);
    };
    sh.info('用搖桿把爪子移到娃娃上面（可以前後左右），爪子的影子變綠就是對準了，再按「夾！」');
    const acts = sh.actions(`<div class="joy" id="joy"><span class="jl u">後</span><span class="jl d">前</span><span class="jl l">左</span><span class="jl r">右</span><div class="joy-knob" id="joyKnob"></div></div><button class="go" id="cmGo">夾！</button>`);
    const joy = acts.querySelector('#joy'), knob = acts.querySelector('#joyKnob');
    let jp = null;
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect(), R = r.width / 2 - 18;
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const dead = 0.18;
      v.x = Math.abs(dx / R) > dead ? dx / R : 0;
      v.z = Math.abs(dy / R) > dead ? -dy / R : 0;
    };
    joy.onpointerdown = (e) => { jp = e.pointerId; joy.setPointerCapture(e.pointerId); setJoy(e); };
    joy.onpointermove = (e) => { if (jp === e.pointerId) setJoy(e); };
    joy.onpointerup = joy.onpointercancel = () => { jp = null; v.x = 0; v.z = 0; knob.style.transform = 'translate(-50%, -50%)'; };
    acts.querySelector('#cmGo').onclick = drop;
    const K = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
    sh.onKey = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (K.includes(k)) { keys[k] = e.type === 'keydown'; e.preventDefault(); return true; }
      return false;
    };
    const ku = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k in keys) keys[k] = false; };
    window.addEventListener('keyup', ku);
    sh.cleanup.push(() => { window.removeEventListener('keyup', ku); cancelAnimationFrame(raf); window.removeEventListener('resize', size); });
    sh.onSpace = drop;
    window.addEventListener('resize', size);
    requestAnimationFrame(() => { size(); raf = requestAnimationFrame(loop); });
  }

  // =====================================================================
  // 猜大小：猜下一張比較大還是比較小；猜對獎金翻倍，可以見好就收
  // =====================================================================
  function hilo(student, back) {
    const sh = shell({ student, icon: '🃏', title: '猜大小', bg: '#14532d', back });
    let pot = 0, card = 0, round = 0, playing = false;
    const MAXR = 5;
    const draw = () => 1 + Math.floor(Math.random() * 10);
    function cardHTML(n, back) { return `<div class="hl-card${back ? ' back' : ''}"><div class="hl-inner"><div class="hl-front"><span>${n || ''}</span></div><div class="hl-backside">?</div></div></div>`; }
    function render() {
      const bigger = 10 - card, smaller = card - 1;
      sh.stage.innerHTML = `
        <div class="hl">
          <div class="hl-pot">${playing ? `獎金 <b>${pot}</b> 點・第 ${round + 1} 關／最多 ${MAXR} 關` : '1 張入場券開始，獎金從 ' + price() + ' 點起跳'}</div>
          <div class="hl-cards">${cardHTML(card, !playing && !card)}<div class="hl-arrow">→</div><div id="hlNext">${cardHTML('', true)}</div></div>
          ${playing ? `<div class="hl-prob">
            <div class="hp-row"><span>比 ${card} 大</span><i style="width:${bigger * 10}%" class="up"></i><b>${bigger} 張</b></div>
            <div class="hp-row"><span>比 ${card} 小</span><i style="width:${smaller * 10}%" class="down"></i><b>${smaller} 張</b></div>
            <div class="hp-note">牌是 1～10，每一張出現的機會一樣</div></div>` : ''}
        </div>`;
      const acts = sh.actions(playing
        ? `<button class="go small" id="hlHi">⬆ 比較大</button><button class="go small" id="hlLo">⬇ 比較小</button>${round > 0 ? `<button class="go small cash" id="hlCash">收手，領 ${pot} 點</button>` : ''}`
        : `<button class="go" id="hlStart">開始（用 1 張入場券）</button>`);
      if (playing) {
        acts.querySelector('#hlHi').onclick = () => guess(1);
        acts.querySelector('#hlLo').onclick = () => guess(-1);
        const c = acts.querySelector('#hlCash'); if (c) c.onclick = () => cash();
      } else acts.querySelector('#hlStart').onclick = start;
      sh.info(playing ? (round > 0 ? '要繼續猜（獎金翻倍），還是見好就收？' : '猜猜看，下一張比較大還是比較小？') : '猜對獎金翻倍，猜錯全部歸零。隨時可以收手！');
    }
    function start() {
      if (sh.busy) return;
      if (!spend(student, 1, '猜大小')) return;
      sh.sub(); pot = price(); round = 0; card = draw(); playing = true;
      Research.decide(student, '猜大小', '開始', { cost: price(), round: 0, note: `第一張牌 ${card}` });
      Sound.ticket(); render();
    }
    async function guess(dir) {
      if (sh.busy) return;
      sh.setBusy(true);
      {
        const good = dir > 0 ? 10 - card : card - 1;
        Research.decide(student, '猜大小', dir > 0 ? '繼續：猜比較大' : '繼續：猜比較小', {
          p: good * 10, prize: pot * 2, cost: pot, ev: good / 10 * pot * 2 + 0.1 * pot - pot, round: round + 1,
          note: `手上的牌 ${card}；押上目前獎金 ${pot} 點；聰明的猜法猜對機率 ${Math.max(10 - card, card - 1) * 10}%`
        });
      }
      let next = draw();
      const stop = FX.suspense(sh.root, 1200);
      await sleep(1100);
      stop();
      const nx = sh.stage.querySelector('#hlNext');
      nx.innerHTML = cardHTML(next, true);
      await sleep(30);
      nx.querySelector('.hl-card').classList.remove('back');
      Sound.whoosh();
      await sleep(650);
      if (next === card) {
        Sound.tick();
        sh.info(`一樣是 ${next}！平手，獎金不變，再猜一次`);
        await sleep(1200);
        sh.setBusy(false); render(); return;
      }
      const right = (dir > 0 && next > card) || (dir < 0 && next < card);
      if (right) {
        pot *= 2; round++; card = next;
        Sound.win(); FX.burst(sh.root, sh.root.clientWidth / 2, sh.root.clientHeight * 0.4, 40, ['#ffd54f', '#ffffff', '#a5d6a7']);
        await sleep(700);
        sh.setBusy(false);
        if (round >= MAXR) { cash(true); return; }
        render();
      } else {
        Sound.zero();
        const lost = pot;
        record(student, '猜大小', 1, 0, { rounds: round, lost });
        playing = false; card = next;
        sh.setBusy(false);
        sh.sub();
        sh.result('猜錯了…獎金歸零', false, [`剛剛的獎金是 ${lost} 點`, round > 0 ? `如果上一關收手，就能拿走 ${lost} 點` : `用掉的 ${ticketWorth(1)} 拿不回來`], [
          ...(student.zoneTickets > 0 ? [{ label: '再玩一次', primary: true, onClick: () => { card = 0; render(); } }] : []),
          { label: '回遊樂場', onClick: () => sh.close() }
        ]);
      }
    }
    function cash(auto) {
      Research.decide(student, '猜大小', '收手', { prize: pot, round, note: auto === true ? '到最後一關自動收手' : `如果繼續，最好的猜法猜對機率 ${Math.max(10 - card, card - 1) * 10}%` });
      record(student, '猜大小', 1, pot, { rounds: round });
      playing = false;
      sh.sub();
      FX.win(sh.root, round >= 3 ? 'big' : 'small', sh.root.querySelector('.fx-behind'));
      sh.result(`收手成功！+${pot} 點`, true, [`連續猜對 ${round} 關`, `用 ${ticketWorth(1)}，拿到 ${pot} 點`], [
        ...(student.zoneTickets > 0 ? [{ label: '再玩一次', primary: true, onClick: () => { card = 0; render(); } }] : []),
        { label: '回遊樂場', onClick: () => sh.close() }
      ]);
    }
    sh.onSpace = () => { if (!playing) start(); };
    // 玩到一半關掉：已經猜對的獎金照樣領走
    sh.cleanup.push(() => { if (playing) { Research.decide(student, '猜大小', '中途離開', { prize: round > 0 ? pot : 0, round }); record(student, '猜大小', 1, round > 0 ? pot : 0, { rounds: round, closed: true }); playing = false; } });
    render();
  }

  // =====================================================================
  // 小動物賽跑：全班一起下注，熱門的容易贏但獎小，冷門的難贏但獎大
  // =====================================================================
  const RACERS = [
    { e: '🐇', name: '兔子', p: 35, x: 2, px: 1.1 },
    { e: '🐕', name: '小狗', p: 25, x: 3, px: 1.2 },
    { e: '🐈', name: '小貓', p: 20, x: 4, px: 1.3 },
    { e: '🐤', name: '小雞', p: 12, x: 6, px: 1.8 },
    { e: '🐢', name: '烏龜', p: 8, x: 10, px: 2.5 }
  ];
  // 跑進前 3 名的機率（照勝率一名一名抽出來）
  const PLACE_P = (() => {
    const p = RACERS.map((r) => r.p / 100), top = p.map(() => 0);
    for (let a = 0; a < p.length; a++) for (let b = 0; b < p.length; b++) for (let c = 0; c < p.length; c++) {
      if (a === b || b === c || a === c) continue;
      const pr = p[a] * p[b] / (1 - p[a]) * p[c] / (1 - p[a] - p[b]);
      top[a] += pr; top[b] += pr; top[c] += pr;
    }
    return top.map((v) => Math.round(v * 100));
  })();
  const BET = { win: '獨贏', place: '位置' };
  // 排行榜：每隻動物贏幾次、進前三幾次（全班共用，存在資料裡）
  function raceStats() {
    const d = W.data; if (!d.arcade) d.arcade = {};
    let st = d.arcade.race;
    if (!st || !Array.isArray(st.wins) || st.wins.length !== RACERS.length) st = d.arcade.race = { races: 0, wins: RACERS.map(() => 0), top3: RACERS.map(() => 0) };
    return st;
  }
  function boardHTML() {
    const st = raceStats(), n = st.races;
    const order = RACERS.map((r, i) => i).sort((a, b) => st.wins[b] - st.wins[a] || RACERS[b].p - RACERS[a].p);
    const max = Math.max(1, ...st.wins);
    return `<div class="rc-board"><div class="rbd-h">🏆 冠軍排行榜 <span>（一共比了 ${n} 場）</span></div>
      ${order.map((i, k) => `<div class="rbd-row"><span class="rk">${['🥇', '🥈', '🥉', '4', '5'][k]}</span><span class="e">${RACERS[i].e}</span><b>${RACERS[i].name}</b>
        <span class="bar"><i style="width:${st.wins[i] / max * 100}%"></i></span><span class="cnt">${st.wins[i]} 次</span>
        <span class="pc">${n ? `實際 ${Math.round(st.wins[i] / n * 100)}%` : ''}<em>機率 ${RACERS[i].p}%</em></span></div>`).join('')}
      ${n && n < 20 ? '<div class="rbd-note">場數還少，實際的比例會跟機率差很多；比越多場，會越接近機率</div>' : ''}</div>`;
  }
  const payOf = (i, type) => Math.round((type === 'place' ? RACERS[i].px : RACERS[i].x) * price());
  function race(student, back) {
    const sh = shell({ student, icon: '🏁', title: '小動物賽跑', bg: '#3d5a1f', back });
    const bets = {}; // studentId → { r: 第幾隻, type: 'win' | 'place' }
    const mode = {}; // studentId → 正在選的押法
    function renderBets() {
      const list = W.cls().students;
      sh.stage.innerHTML = `
        <div class="rc">
          ${boardHTML()}
          <div class="rc-odds">${RACERS.map((r, i) => `<div class="rc-o"><span class="e">${r.e}</span><b>${r.name}</b>
            <span class="pi">${Array.from({ length: 10 }, (_, k) => `<i class="${k < Math.round(r.p / 10) ? 'on' : ''}"></i>`).join('')}</span>
            <span class="od"><em>獨贏</em> 第 1 名・約 ${r.p}%<b class="pay">拿 ${payOf(i, 'win')} 點</b></span>
            <span class="od pl"><em>位置</em> 前 3 名・約 ${PLACE_P[i]}%<b class="pay">拿 ${payOf(i, 'place')} 點</b></span></div>`).join('')}</div>
          <div class="rc-bets">${list.map((s) => {
            const t = s.zoneTickets || 0, b = bets[s.id], m = (b && b.type) || mode[s.id] || 'win';
            return `<div class="rb-row${t ? '' : ' no'}"><span class="nm">${Avatar.html(s, 26)} ${esc(s.name)}</span><span class="tk">🎟${t}</span>
              <span class="rb-type">${Object.entries(BET).map(([k, v]) => `<button data-ts="${s.id}" data-t="${k}" class="${m === k ? 'sel' : ''}"${t ? '' : ' disabled'}>${v}</button>`).join('')}</span>
              <span class="picks">${RACERS.map((r, i) => `<button data-s="${s.id}" data-r="${i}" class="${b && b.r === i ? 'sel' : ''}"${t ? '' : ' disabled'}>${r.e}</button>`).join('')}</span></div>`;
          }).join('')}</div>
        </div>`;
      sh.stage.querySelectorAll('[data-t]').forEach((el) => el.onclick = () => {
        const sid = el.dataset.ts; mode[sid] = el.dataset.t;
        if (bets[sid]) bets[sid].type = el.dataset.t;
        Sound.tick(); renderBets();
      });
      sh.stage.querySelectorAll('[data-r]').forEach((el) => el.onclick = () => {
        const sid = el.dataset.s, r = Number(el.dataset.r);
        bets[sid] = bets[sid] && bets[sid].r === r ? null : { r, type: mode[sid] || 'win' };
        Sound.tick(); renderBets();
      });
      const n = Object.values(bets).filter(Boolean).length;
      sh.info(`每個人押 1 隻（用 1 張入場券）：「獨贏」要跑第 1 名，「位置」跑進前 3 名就算中。已經有 ${n} 人押好了。`);
      sh.actions(`<button class="go${n ? '' : ' off'}" id="rcGo">開跑！</button>`).querySelector('#rcGo').onclick = run;
    }
    async function run() {
      if (sh.busy) return;
      const list = W.cls().students;
      const entries = list.filter((s) => bets[s.id] && (s.zoneTickets || 0) > 0);
      if (!entries.length) { W.toast('還沒有人押注', false); return; }
      W.snapshot('小動物賽跑');
      entries.forEach((s) => {
        s.zoneTickets -= 1;
        const b = bets[s.id], rc = RACERS[b.r];
        Research.decide(s, '小動物賽跑', `押${rc.name}（${BET[b.type]}）`, {
          p: b.type === 'place' ? PLACE_P[b.r] : rc.p, prize: payOf(b.r, b.type), cost: price(),
          note: `${s.id === student.id ? '開這一場的人' : '一起押的同學'}；押法：${BET[b.type]}`
        });
      });
      W.save();
      sh.setBusy(true); sh.sub();
      // 先照勝率一名一名抽出名次，再演出比賽
      const order = [], left = RACERS.map((_, i) => i);
      while (left.length) {
        const tot = left.reduce((a, i) => a + RACERS[i].p, 0);
        let r = Math.random() * tot, pick = left[left.length - 1];
        for (const i of left) { r -= RACERS[i].p; if (r < 0) { pick = i; break; } }
        order.push(pick); left.splice(left.indexOf(pick), 1);
      }
      const win = order[0], podium = order.slice(0, 3);
      const backers = (i) => entries.filter((s) => bets[s.id].r === i).map((s) => `<span class="bk ${bets[s.id].type}">${Avatar.html(s, 22)}</span>`).join('');
      sh.stage.innerHTML = `<div class="rc-track">${RACERS.map((rc, i) => `<div class="lane"><span class="ln">${i + 1}</span><div class="runner" id="rn${i}">${rc.e}</div><div class="finish"></div><div class="rank" id="rk${i}"></div><div class="backers">${backers(i)}</div></div>`).join('')}</div><div class="rc-comment" id="rcCmt">預備…</div><div class="rc-legend">頭像有金框＝押「位置」（前 3 名就中）</div>`;
      sh.actions('');
      sh.info('');
      const cmt = sh.stage.querySelector('#rcCmt');
      for (const w of ['3', '2', '1', '跑！']) { cmt.textContent = w; Sound.tick(); await sleep(450); }
      const T = 7000;
      const finish = RACERS.map(() => 0);
      order.forEach((i, k) => { finish[i] = k === 0 ? T : finish[order[k - 1]] + 180 + Math.random() * (k < 3 ? 420 : 900); });
      const phase = RACERS.map(() => Math.random() * 6);
      const t0 = performance.now();
      let leader = -1, lastStep = 0;
      const shown = {};
      const stop = FX.suspense(sh.root, T, { music: (ms) => Sound.raceMusic(ms / 1000 + 0.4) });
      await new Promise((res) => {
        const frame = (now) => {
          if (sh.closed) { res(); return; }
          const t = now - t0;
          const pos = RACERS.map((_, i) => {
            const base = Math.min(1, t / finish[i]);
            const wob = 0.06 * Math.sin(t / 420 + phase[i]) * Math.sin(Math.min(1, t / finish[i]) * Math.PI);
            return Math.max(0, Math.min(1, base + wob));
          });
          pos.forEach((p, i) => {
            const el = sh.stage.querySelector('#rn' + i); if (el) el.style.left = `calc(${(p * 78).toFixed(2)}% + 24px)`;
            if (t >= finish[i] && !shown[i]) {
              shown[i] = true;
              const k = order.indexOf(i), rk = sh.stage.querySelector('#rk' + i);
              if (rk) { rk.textContent = ['🥇', '🥈', '🥉', '4', '5'][k]; rk.classList.add('on'); }
              if (k < 3) Sound.bell();
            }
          });
          const lead = pos.indexOf(Math.max(...pos));
          if (lead !== leader && t > 600 && t < T) { leader = lead; cmt.textContent = `${RACERS[lead].e} ${RACERS[lead].name}領先！`; Sound.tick(); }
          if (now - lastStep > 220 && t < T) { Sound.rattle(); lastStep = now; }
          if (t < Math.max(...finish) + 300) requestAnimationFrame(frame); else res();
        };
        requestAnimationFrame(frame);
      });
      stop();
      if (sh.closed) return;
      cmt.textContent = `🏆 ${RACERS[win].e} ${RACERS[win].name}贏了！`;
      {
        const st = raceStats();
        st.races++; st.wins[win]++; podium.forEach((i) => { st.top3[i]++; });
        W.save();
      }
      const winners = [];
      let bigHit = false;
      entries.forEach((s) => {
        const b = bets[s.id];
        const hit = b.type === 'place' ? podium.includes(b.r) : b.r === win;
        const prize = hit ? payOf(b.r, b.type) : 0;
        if (hit && b.type === 'win' && RACERS[b.r].x >= 6) bigHit = true;
        record(s, '小動物賽跑', 1, prize, { bet: BET[b.type], racer: RACERS[b.r].name, winner: RACERS[win].name, place: order.indexOf(b.r) + 1 });
        if (hit) winners.push(`${esc(s.name)}（${BET[b.type]}）+${prize}`);
      });
      FX.win(sh.root, winners.length ? (bigHit ? 'big' : 'small') : 'miss', sh.root.querySelector('.fx-behind'));
      sh.sub();
      await sleep(900);
      sh.setBusy(false);
      sh.result(`${RACERS[win].e} ${RACERS[win].name}贏了！`, winners.length > 0, [
        `名次：🥇${RACERS[podium[0]].e} 🥈${RACERS[podium[1]].e} 🥉${RACERS[podium[2]].e}`,
        winners.length ? `押中的人：${winners.join('、')}` : '這次沒有人押中',
        `${RACERS[win].name}拿第 1 名的機會大約 ${RACERS[win].p}%，${RACERS[win].x >= 6 ? '是冷門爆冷！' : '是熱門之一'}`
      ], [
        { label: '再比一場', primary: true, onClick: () => { Object.keys(bets).forEach((k) => { bets[k] = null; }); renderBets(); } },
        { label: '回遊樂場', onClick: () => sh.close() }
      ]);
    }
    sh.onSpace = run;
    renderBets();
  }

  // =====================================================================
  // 打地鼠：靠反應得分（獎勵努力，不靠運氣）
  // =====================================================================
  function mole(student, back) {
    const sh = shell({ student, icon: '🔨', title: '打地鼠', bg: '#5a3a1a', back });
    const DUR = 20000, FEVER = 10000;
    let hits = 0, timers = [], running = false;
    // 速度：前 10 秒慢慢變快，最後 10 秒超快
    const speed = (t) => {
      if (t < FEVER) { const f = t / FEVER; return { up: 1150 - f * 450, gap: 680 - f * 300, two: 0 }; }
      const g = Math.min(1, (t - FEVER) / (DUR - FEVER));
      return { up: 560 - g * 230, gap: 300 - g * 140, two: 0.35 + g * 0.35 };
    };
    function intro() {
      sh.stage.innerHTML = `<div class="mo-intro"><div class="mo-big">🔨</div><div>20 秒內打越多地鼠越好！金色地鼠 +3</div><div>地鼠會越跑越快，<b>最後 10 秒超級快</b>！</div><div>每打中 ${Math.max(1, Number(A().molePer) || 2)} 隻得 1 點</div></div>`;
      sh.actions('<button class="go" id="moStart">開始（用 1 張入場券）</button>').querySelector('#moStart').onclick = start;
      sh.info('');
    }
    function start() {
      if (sh.busy || running) return;
      if (!spend(student, 1, '打地鼠')) return;
      Research.decide(student, '打地鼠', '開始', { cost: price() });
      sh.sub(); hits = 0; running = true; sh.setBusy(true);
      sh.actions('');
      sh.info('點冒出來的地鼠！');
      sh.stage.innerHTML = `<div class="mo"><div class="mo-hud"><span>🔨 <b id="moHits">0</b></span><div class="mo-time"><i id="moBar"></i></div><span class="mo-sec" id="moSec">20</span></div>
        <div class="mo-grid">${Array.from({ length: 9 }, (_, i) => `<div class="hole" data-h="${i}"><div class="mole"></div></div>`).join('')}</div></div>`;
      const t0 = performance.now();
      const el = (id) => sh.stage.querySelector(id);
      let fever = false;
      const tick = () => {
        if (!running) return;
        const t = performance.now() - t0, p = Math.min(1, t / DUR);
        el('#moBar').style.width = (100 - p * 100) + '%';
        el('#moSec').textContent = Math.ceil((DUR - t) / 1000);
        if (!fever && t >= FEVER) { fever = true; sh.stage.querySelector('.mo').classList.add('fever'); sh.info('⚡ 最後 10 秒！超快！'); Sound.bell(); }
        if (p < 1) timers.push(requestAnimationFrame(tick));
      };
      tick();
      const popOne = (cfg) => {
        const holes = [...sh.stage.querySelectorAll('.hole:not(.up)')];
        if (!holes.length) return;
        const h = holes[Math.floor(Math.random() * holes.length)];
        const gold = Math.random() < 0.1;
        h.classList.add('up'); h.classList.toggle('gold', gold);
        h.querySelector('.mole').textContent = gold ? '🌟' : '🐹';
        timers.push(setTimeout(() => h.classList.remove('up', 'gold', 'hit'), cfg.up));
      };
      const pop = () => {
        if (!running) return;
        const cfg = speed(performance.now() - t0);
        popOne(cfg);
        if (Math.random() < cfg.two) popOne(cfg);
        timers.push(setTimeout(pop, cfg.gap * (0.7 + Math.random() * 0.6)));
      };
      pop();
      sh.stage.querySelector('.mo-grid').onpointerdown = (e) => {
        const h = e.target.closest('.hole');
        if (!h || !h.classList.contains('up') || h.classList.contains('hit')) return;
        const gold = h.classList.contains('gold');
        hits += gold ? 3 : 1;
        h.classList.add('hit');
        sh.stage.querySelector('#moHits').textContent = hits;
        Sound.tap(Math.min(1, hits / 30));
        const r = sh.root.getBoundingClientRect(), b = h.getBoundingClientRect();
        FX.burst(sh.root, b.left - r.left + b.width / 2, b.top - r.top + b.height / 3, gold ? 30 : 12, gold ? ['#ffd54f', '#fff'] : ['#ffe082', '#ffffff', '#ffab91']);
        setTimeout(() => h.classList.remove('up', 'gold', 'hit'), 160);
      };
      timers.push(setTimeout(end, DUR));
    }
    function stopAll() { running = false; timers.forEach((t) => { clearTimeout(t); cancelAnimationFrame(t); }); timers = []; }
    function end() {
      stopAll();
      const per = Math.max(1, Number(A().molePer) || 2);
      const prize = Math.floor(hits / per);
      record(student, '打地鼠', 1, prize, { hits });
      sh.sub(); sh.setBusy(false);
      FX.win(sh.root, prize >= price() * 1.5 ? 'big' : prize > 0 ? 'small' : 'miss', sh.root.querySelector('.fx-behind'));
      sh.result(`打中 ${hits} 隻！+${prize} 點`, prize > 0, [`每打中 ${per} 隻得 1 點`, prize >= price() ? '比入場券的價值還多，努力有收穫！' : '多練習，反應會越來越快'], [
        ...(student.zoneTickets > 0 ? [{ label: '再玩一次', primary: true, onClick: intro }] : []),
        { label: '回遊樂場', onClick: () => sh.close() }
      ]);
    }
    sh.cleanup.push(stopAll);
    sh.onSpace = () => { if (!running) start(); };
    intro();
  }

  // =====================================================================
  // 翻牌記憶配對：翻出兩張一樣的；錯越少分越多
  // =====================================================================
  const MEM_EMOJI = ['🍎', '🍌', '🍇', '🍉', '🍓', '🥕', '🌽', '🍩', '🚗', '🚀', '⚽', '🎈'];
  function memory(student, back) {
    const sh = shell({ student, icon: '🧠', title: '翻牌記憶配對', bg: '#1f4e5f', back });
    const LV = { easy: { pairs: 6, cols: 4, name: '簡單（6 對）' }, normal: { pairs: 8, cols: 4, name: '普通（8 對）' }, hard: { pairs: 10, cols: 5, name: '困難（10 對）' } };
    let cards = [], open = [], mistakes = 0, found = 0, lvl = null;
    function intro() {
      sh.stage.innerHTML = '<div class="mo-intro"><div class="mo-big">🧠</div><div>翻出兩張一樣的牌！</div><div>翻錯越少次，得到的點數越多</div></div>';
      const acts = sh.actions(Object.entries(LV).map(([k, v]) => `<button class="go small" data-lv="${k}">${v.name}</button>`).join(''));
      acts.querySelectorAll('[data-lv]').forEach((b) => b.onclick = () => start(b.dataset.lv));
      sh.info('選難度開始（用 1 張入場券）');
    }
    function start(k) {
      if (!spend(student, 1, '翻牌記憶配對')) return;
      Research.decide(student, '翻牌記憶配對', LV[k].name, { cost: price() });
      sh.sub(); lvl = LV[k]; mistakes = 0; found = 0; open = [];
      const pick = shuffle(MEM_EMOJI).slice(0, lvl.pairs);
      cards = shuffle([...pick, ...pick]).map((e) => ({ e, done: false }));
      sh.actions('');
      sh.stage.innerHTML = `<div class="mem" style="--cols:${lvl.cols}">${cards.map((c, i) => `<div class="mc" data-i="${i}"><div class="mc-in"><div class="mc-f">${c.e}</div><div class="mc-b">?</div></div></div>`).join('')}</div>`;
      sh.info(`翻錯 0 次・找到 0／${lvl.pairs} 對`);
      sh.stage.querySelector('.mem').onclick = flip;
    }
    async function flip(e) {
      const el = e.target.closest('.mc');
      if (!el || el.classList.contains('show') || open.length >= 2) return;
      el.classList.add('show'); Sound.tick();
      open.push(Number(el.dataset.i));
      if (open.length < 2) return;
      const [a, b] = open;
      if (cards[a].e === cards[b].e) {
        found++; Sound.reveal(2);
        [a, b].forEach((i) => sh.stage.querySelector(`.mc[data-i="${i}"]`).classList.add('done'));
        open = [];
      } else {
        mistakes++;
        await sleep(800);
        [a, b].forEach((i) => sh.stage.querySelector(`.mc[data-i="${i}"]`).classList.remove('show'));
        open = [];
      }
      sh.info(`翻錯 ${mistakes} 次・找到 ${found}／${lvl.pairs} 對`);
      if (found === lvl.pairs) finish();
    }
    function finish() {
      const prize = Math.max(5, lvl.pairs * 3 - mistakes);
      record(student, '翻牌記憶配對', 1, prize, { mistakes, pairs: lvl.pairs });
      sh.sub();
      FX.win(sh.root, mistakes <= lvl.pairs / 2 ? 'big' : 'small', sh.root.querySelector('.fx-behind'));
      sh.result(`全部配對成功！+${prize} 點`, true, [`翻錯 ${mistakes} 次`, `最多可以拿 ${lvl.pairs * 3} 點，每翻錯 1 次少 1 點`], [
        ...(student.zoneTickets > 0 ? [{ label: '再玩一次', primary: true, onClick: intro }] : []),
        { label: '回遊樂場', onClick: () => sh.close() }
      ]);
    }
    intro();
  }

  // =====================================================================
  // 存錢機：放 1 張入場券，幾天後可以領回 2 張（延宕滿足）
  // =====================================================================
  const DAY = 864e5;
  const saveDays = () => Math.max(1, Math.min(60, Number(A().saveDays) || 7));
  function savings(s) { if (!Array.isArray(s.savings)) s.savings = []; return s.savings; }
  function saveTicket(s) {
    if ((s.zoneTickets || 0) < 1) { W.toast('沒有入場券可以存', false); return false; }
    W.snapshot(`${s.name} 存錢機`);
    s.zoneTickets -= 1;
    savings(s).push({ id: Math.random().toString(36).slice(2, 9), t: Date.now(), days: saveDays() });
    W.data.history.push({ t: new Date().toISOString(), type: 'arcade', classId: W.cls().id, studentId: s.id, name: s.name, delta: 0, score: s.score, item: '存錢機', tickets: 1, prize: 0, saved: true });
    Research.saving(s, '存入', `存 1 張，${saveDays()} 天後可領回 2 張`);
    W.save(); Sound.ticket();
    return true;
  }
  function claimSaving(s, id, early) {
    const list = savings(s), d = list.find((x) => x.id === id);
    if (!d) return;
    const due = d.t + d.days * DAY;
    if (!early && Date.now() < due) return;
    W.snapshot(`${s.name} 存錢機領回`);
    const back = early ? 1 : 2;
    s.zoneTickets = (s.zoneTickets || 0) + back;
    s.savings = list.filter((x) => x !== d);
    Research.saving(s, early ? '提早領回' : '到期領回', `等了 ${Math.floor((Date.now() - d.t) / DAY)} 天／要等 ${d.days} 天；領回 ${back} 張`);
    W.data.history.push({ t: new Date().toISOString(), type: 'arcade', classId: W.cls().id, studentId: s.id, name: s.name, delta: 0, score: s.score, item: early ? '存錢機（提早領回 1 張）' : '存錢機（到期領回 2 張）', tickets: -back, prize: 0, saved: true });
    W.save();
    if (early) Sound.minus(); else { Sound.fanfare(); }
  }
  function savingsHTML(s) {
    const list = savings(s);
    const now = Date.now();
    return `<div class="sv">
      <div class="sv-head"><span class="sv-ic">🐷</span><div><b>存錢機</b><div class="sv-d">存 1 張入場券，${saveDays()} 天後領回 2 張！提早拿只能拿回 1 張。</div></div>
        <button id="svSave" class="${(s.zoneTickets || 0) ? 'primary' : 'off'}">存 1 張</button></div>
      ${list.length ? `<div class="sv-list">${list.map((d) => {
        const left = Math.ceil((d.t + d.days * DAY - now) / DAY);
        return left <= 0
          ? `<div class="sv-item ready">🎉 到期了！<button data-claim="${d.id}" class="primary">領回 2 張</button></div>`
          : `<div class="sv-item">🐷 1 張・還有 ${left} 天<span class="sv-bar"><i style="width:${Math.round((1 - left / d.days) * 100)}%"></i></span><button data-early="${d.id}">提早拿回 1 張</button></div>`;
      }).join('')}</div>` : ''}
    </div>`;
  }

  const GAMES = { plinko, claw, hilo, race, mole, memory };

  function onKey(e) {
    if (!cur) return false;
    if (cur.onKey && cur.onKey(e)) return true;
    if (e.key === 'Escape') { if (!cur.busy) cur.close(); return true; }
    if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('input, textarea, select')) {
      e.preventDefault();
      const res = cur.root.querySelector('.ar-result');
      if (!res.classList.contains('hidden')) res.querySelector('button').click();
      else if (cur.onSpace && !cur.busy) cur.onSpace();
    }
    return true;
  }

  return {
    open: (game, s, back) => GAMES[game](s, back), onKey, isOpen: () => !!cur,
    close: () => { if (cur) cur.close(true); },
    savingsHTML, saveTicket, claimSaving, plinkoPrizes, plinkoEV, openBook
  };
})();
