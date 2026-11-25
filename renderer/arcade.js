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
  const NOTE = { slot: '落在第幾格(0起)', tries: '這次連玩第幾次', rounds: '猜對幾關', lost: '輸掉的獎金', closed: '中途關掉', racer: '押', winner: '贏的是', hits: '打中', mistakes: '翻錯', pairs: '幾對' };
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
    const sh = shell({ student, icon: '🔵', title: '彈珠台', bg: '#1b2a4a', back });
    sh.root.classList.add('pl');
    sh.stage.innerHTML = '<canvas class="pl-cv"></canvas>';
    const cv = sh.stage.querySelector('canvas');
    const prizes = plinkoPrizes();
    const top = Math.max(...prizes);
    const H = 420, Wd = 300, cx = 150, dx = 28, dy = 30, y0 = 60, PR = 3.6, BR = 7;
    const slotY = y0 + PL_ROWS * dy + 6;
    let g, scale;
    const hist = () => { const d = W.data; if (!d.arcade) d.arcade = {}; if (!Array.isArray(d.arcade.plinkoHist) || d.arcade.plinkoHist.length !== PL_ROWS + 1) d.arcade.plinkoHist = new Array(PL_ROWS + 1).fill(0); return d.arcade.plinkoHist; };
    let ball = null, flash = -1;
    function size() {
      const st = sh.stage.getBoundingClientRect();
      scale = Math.max(0.6, Math.min(st.width / Wd, st.height / H));
      const dpr = window.devicePixelRatio || 1;
      cv.style.width = Wd * scale + 'px'; cv.style.height = H * scale + 'px';
      cv.width = Wd * scale * dpr; cv.height = H * scale * dpr;
      g = cv.getContext('2d');
      g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      draw();
    }
    const pegX = (i, j) => cx + (j - i / 2) * dx;
    const slotX = (k) => cx + (k - PL_ROWS / 2) * dx;
    function draw() {
      g.clearRect(0, 0, Wd, H);
      // 漏斗
      g.fillStyle = '#24365e'; g.fillRect(4, 4, Wd - 8, H - 8);
      g.strokeStyle = '#8fb3ff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(40, 8); g.lineTo(cx - 10, y0 - 22); g.moveTo(Wd - 40, 8); g.lineTo(cx + 10, y0 - 22); g.stroke();
      // 釘子
      for (let i = 0; i < PL_ROWS; i++) for (let j = 0; j <= i; j++) {
        g.fillStyle = '#e8eef9'; g.beginPath(); g.arc(pegX(i, j), y0 + i * dy, PR, 0, Math.PI * 2); g.fill();
      }
      // 格子與獎項
      const hs = hist(), maxH = Math.max(1, ...hs);
      for (let k = 0; k <= PL_ROWS; k++) {
        const x = slotX(k) - dx / 2;
        g.fillStyle = k === flash ? '#ffe082' : (prizes[k] === top ? '#d4a017' : (k % 2 ? '#3b5bdb' : '#4263eb'));
        g.fillRect(x + 1, slotY, dx - 2, 34);
        g.fillStyle = prizes[k] === top && k !== flash ? '#3b2400' : (k === flash ? '#3b2400' : '#fff');
        g.font = 'bold 11px "Microsoft JhengHei UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(prizes[k]), slotX(k), slotY + 17);
        // 落點分布（機率看得見）
        const bh = hs[k] / maxH * 44;
        g.fillStyle = 'rgba(255,213,79,.85)';
        g.fillRect(x + 4, slotY + 40 + (44 - bh), dx - 8, bh);
        g.fillStyle = '#cfe0ff'; g.font = '9px sans-serif';
        g.fillText(String(hs[k]), slotX(k), slotY + 92);
      }
      g.fillStyle = '#9fb7e6'; g.font = '10px "Microsoft JhengHei UI", sans-serif'; g.textAlign = 'left';
      g.fillText('黃色長條：全班丟過的珠子掉在哪裡', 10, H - 8);
      if (ball) {
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(ball.x + 2, ball.y + 3, BR, 0, Math.PI * 2); g.fill();
        const gr = g.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, BR);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9aa7b8');
        g.fillStyle = gr; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, Math.PI * 2); g.fill();
      }
    }
    const anim = (fromX, fromY, toX, toY, ms, arcH) => new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        if (sh.closed) { res(); return; }
        const p = Math.min(1, (now - t0) / ms);
        ball = { x: fromX + (toX - fromX) * p, y: fromY + (toY - fromY) * p * p - Math.sin(p * Math.PI) * arcH };
        draw();
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    async function drop(side) {
      if (sh.busy) return;
      if (!spend(student, 1, '彈珠台')) return;
      Research.decide(student, '彈珠台', { L: '從左邊放', M: '從中間放', R: '從右邊放' }[side], { cost: price(), ev: plinkoEV() - price(), prize: top, note: '每一格機率固定，從哪裡放都一樣' });
      sh.setBusy(true); sh.sub(); FX.clear(sh.root);
      const startX = side === 'L' ? 60 : side === 'R' ? Wd - 60 : cx;
      Sound.whoosh();
      await anim(startX, 12, cx, y0 - PR - BR, 420, 0);
      let j = 0;
      for (let i = 0; i < PL_ROWS; i++) {
        Sound.tick();
        const right = Math.random() < 0.5;
        const x0 = pegX(i, j), yA = y0 + i * dy - PR - BR;
        const slow = i >= PL_ROWS - 2 ? 1.9 : 1;
        if (i < PL_ROWS - 1) {
          const nj = j + (right ? 1 : 0);
          await anim(x0, yA, pegX(i + 1, nj), y0 + (i + 1) * dy - PR - BR, 170 * slow, 9);
          j = nj;
        } else {
          const k = j + (right ? 1 : 0);
          await anim(x0, yA, slotX(k), slotY + 14, 320 * slow, 10);
          j = k;
        }
        if (sh.closed) return;
      }
      Sound.clunk();
      const k = j, prize = plinkoPrizes()[k];
      hist()[k]++;
      flash = k; draw();
      record(student, '彈珠台', 1, prize, { slot: k });
      sh.sub();
      if (prize >= top) FX.win(sh.root, 'big', sh.root.querySelector('.fx-behind'));
      else if (prize > price()) FX.win(sh.root, 'small', sh.root.querySelector('.fx-behind'));
      else if (prize === 0) FX.win(sh.root, 'miss'); else Sound.ticket();
      await sleep(700);
      sh.setBusy(false);
      const total = hist().reduce((a, b) => a + b, 0);
      sh.result(`得到 ${prize} 點`, prize > price(), [
        `用了 ${ticketWorth(1)}，拿到 ${prize} 點`,
        `全班一共丟了 ${total} 顆，看看黃色長條：中間是不是比較多？`
      ], [
        ...(student.zoneTickets > 0 ? [{ label: '再丟一顆', primary: true, onClick: () => { flash = -1; ball = null; draw(); } }] : []),
        { label: '回遊樂場', onClick: () => sh.close() }
      ]);
    }
    sh.info('選一個洞口放珠子。珠子會撞到釘子左右亂彈，兩邊的大獎很難掉進去喔！');
    sh.actions(`<button class="go small" data-side="L">從左邊放</button><button class="go small" data-side="M">從中間放</button><button class="go small" data-side="R">從右邊放</button>`)
      .querySelectorAll('[data-side]').forEach((b) => b.onclick = () => drop(b.dataset.side));
    sh.onSpace = () => drop('M');
    requestAnimationFrame(size);
    const rs = () => size();
    window.addEventListener('resize', rs);
    sh.cleanup.push(() => window.removeEventListener('resize', rs));
  }

  // =====================================================================
  // 夾娃娃機：自己移動爪子；夾中的機率由老師設定；提醒「沉沒成本」
  // =====================================================================
  const PLUSH = ['🧸', '🐻', '🐰', '🦄', '🐥', '🐼', '🐸', '🐶'];
  function claw(student, back) {
    const sh = shell({ student, icon: '🧸', title: '夾娃娃機', bg: '#4a1d3f', back });
    sh.stage.innerHTML = `
      <div class="cm">
        <div class="cm-top"><span>夾娃娃機</span></div>
        <div class="cm-box" id="cmBox">
          <div class="cm-rail"></div>
          <div class="cm-claw" id="cmClaw"><div class="cm-rope" id="cmRope"></div><div class="cm-head"><i class="l"></i><i class="r"></i></div><div class="cm-held" id="cmHeld"></div></div>
          <div class="cm-chute">出口</div>
          <div class="cm-prizes" id="cmPrizes"></div>
        </div>
        <div class="cm-base"><span class="cm-slot">🎟</span></div>
      </div>`;
    const box = sh.stage.querySelector('#cmBox');
    const clawEl = sh.stage.querySelector('#cmClaw');
    const rope = sh.stage.querySelector('#cmRope');
    const held = sh.stage.querySelector('#cmHeld');
    let x = 50, tries = 0, moving = 0, raf = 0, failRun = 0;
    let prizes = [24, 38, 52, 66, 80].map((px) => ({ x: px + (Math.random() * 6 - 3), e: PLUSH[Math.floor(Math.random() * PLUSH.length)] }));
    const renderPrizes = () => { sh.stage.querySelector('#cmPrizes').innerHTML = prizes.map((p, i) => `<span class="cm-p" data-i="${i}" style="left:${p.x}%">${p.e}</span>`).join(''); };
    const setX = () => { clawEl.style.left = x + '%'; };
    renderPrizes(); setX();
    const loop = () => {
      if (moving && !sh.busy) { x = Math.max(16, Math.min(90, x + moving * 0.6)); setX(); clawEl.classList.add('sway'); } else clawEl.classList.remove('sway');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    sh.cleanup.push(() => cancelAnimationFrame(raf));
    const drop = async () => {
      if (sh.busy) return;
      if (!spend(student, 1, '夾娃娃機')) return;
      tries++;
      {
        const aligned = prizes.some((p) => Math.abs(p.x - x) < 6.5);
        const gp = Math.max(0, Math.min(100, grip0()));
        Research.decide(student, '夾娃娃機', '夾', { p: aligned ? gp : 0, prize: Math.max(1, Number(A().clawPrize) || 30), cost: price(), round: tries, sunk: failRun, note: aligned ? '爪子有對準娃娃' : '爪子沒對準' });
      }
      sh.setBusy(true); sh.sub();
      const boxH = box.clientHeight;
      const depth = boxH * 0.62;
      clawEl.classList.add('open');
      Sound.lever();
      rope.style.transition = 'height 1s ease-in'; rope.style.height = depth + 'px';
      await sleep(1050);
      clawEl.classList.remove('open');
      Sound.clunk();
      await sleep(350);
      const idx = prizes.findIndex((p) => Math.abs(p.x - x) < 6.5);
      const grip = Math.max(0, Math.min(100, grip0()));
      const success = idx >= 0 && Math.random() * 100 < grip;
      if (idx >= 0) {
        // 抓起來
        held.textContent = prizes[idx].e;
        sh.stage.querySelector(`.cm-p[data-i="${idx}"]`).style.visibility = 'hidden';
      }
      rope.style.transition = 'height 1.4s ease-out';
      rope.style.height = (success || idx < 0 ? 14 : depth * 0.45) + 'px';
      const stopWait = idx >= 0 ? FX.suspense(sh.root, 1400) : () => {};
      await sleep(1450);
      stopWait();
      let prize = 0;
      if (idx >= 0 && !success) {
        // 掉下來了…
        held.classList.add('fall');
        Sound.zero();
        await sleep(600);
        held.classList.remove('fall'); held.textContent = '';
        sh.stage.querySelector(`.cm-p[data-i="${idx}"]`).style.visibility = '';
        prizes[idx].x = Math.max(20, Math.min(86, prizes[idx].x + (Math.random() * 10 - 5)));
        renderPrizes();
        rope.style.transition = 'height .6s'; rope.style.height = '14px';
        await sleep(600);
      } else if (success) {
        // 移到出口
        clawEl.style.transition = 'left 1.2s ease-in-out';
        x = 9; setX();
        await sleep(1250);
        clawEl.classList.add('open');
        held.classList.add('drop');
        Sound.clunk();
        await sleep(500);
        held.classList.remove('drop'); held.textContent = '';
        clawEl.classList.remove('open');
        clawEl.style.transition = '';
        prize = Math.max(1, Number(A().clawPrize) || 30);
        prizes[idx] = { x: 20 + Math.random() * 66, e: PLUSH[Math.floor(Math.random() * PLUSH.length)] };
        renderPrizes();
        FX.win(sh.root, 'big', sh.root.querySelector('.fx-behind'));
        x = 50; setX();
      } else {
        Sound.zero();
      }
      record(student, '夾娃娃機', 1, prize, { tries });
      failRun = prize ? 0 : failRun + 1;
      sh.sub();
      await sleep(500);
      sh.setBusy(false);
      const lines = prize
        ? [`夾到了！得到 ${prize} 點`, `在這台一共用了 ${ticketWorth(tries)}`]
        : [idx >= 0 ? '差一點…娃娃掉下來了' : '爪子下面沒有娃娃', `在這台已經用了 ${ticketWorth(tries)}`, '用掉的拿不回來；下一次夾中的機率還是一樣，不會因為前面失敗就比較容易。'];
      sh.result(prize ? '🎉 夾到了！' : '沒夾到…', !!prize, lines, [
        ...(student.zoneTickets > 0 ? [{ label: '再夾一次', primary: true, onClick: () => {} }] : []),
        { label: '不玩了', onClick: () => sh.close() }
      ]);
    };
    sh.info('按住 ◀ ▶ 移動爪子，對準娃娃後按「夾！」');
    const acts = sh.actions(`<button class="go small hold" data-mv="-1">◀</button><button class="go" id="cmGo">夾！</button><button class="go small hold" data-mv="1">▶</button>`);
    acts.querySelectorAll('[data-mv]').forEach((b) => {
      const v = Number(b.dataset.mv);
      b.onpointerdown = (e) => { moving = v; b.setPointerCapture(e.pointerId); };
      b.onpointerup = b.onpointercancel = () => { moving = 0; };
    });
    acts.querySelector('#cmGo').onclick = drop;
    sh.onKey = (e) => {
      if (e.key === 'ArrowLeft') { moving = e.type === 'keydown' ? -1 : 0; return true; }
      if (e.key === 'ArrowRight') { moving = e.type === 'keydown' ? 1 : 0; return true; }
      return false;
    };
    const ku = (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') moving = 0; };
    window.addEventListener('keyup', ku);
    sh.cleanup.push(() => window.removeEventListener('keyup', ku));
    sh.onSpace = drop;
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
    { e: '🐇', name: '兔子', p: 35, x: 2 },
    { e: '🐕', name: '小狗', p: 25, x: 3 },
    { e: '🐈', name: '小貓', p: 20, x: 4 },
    { e: '🐤', name: '小雞', p: 12, x: 6 },
    { e: '🐢', name: '烏龜', p: 8, x: 10 }
  ];
  function race(student, back) {
    const sh = shell({ student, icon: '🏁', title: '小動物賽跑', bg: '#3d5a1f', back });
    const bets = {}; // studentId → racer index
    if ((student.zoneTickets || 0) > 0) bets[student.id] = null;
    function renderBets() {
      const list = W.cls().students;
      sh.stage.innerHTML = `
        <div class="rc">
          <div class="rc-odds">${RACERS.map((r) => `<div class="rc-o"><span class="e">${r.e}</span><b>${r.name}</b><span class="pi">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(r.p / 10) ? 'on' : ''}"></i>`).join('')}</span><span>大約 ${r.p}%</span><span class="pay">贏了拿 ${r.x * price()} 點</span></div>`).join('')}</div>
          <div class="rc-bets">${list.map((s) => {
            const t = s.zoneTickets || 0, pick = bets[s.id];
            return `<div class="rb-row${t ? '' : ' no'}"><span class="nm">${Avatar.html(s, 26)} ${esc(s.name)}</span><span class="tk">🎟${t}</span>
              <span class="picks">${RACERS.map((r, i) => `<button data-s="${s.id}" data-r="${i}" class="${pick === i ? 'sel' : ''}"${t ? '' : ' disabled'}>${r.e}</button>`).join('')}</span></div>`;
          }).join('')}</div>
        </div>`;
      sh.stage.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
        const sid = b.dataset.s, r = Number(b.dataset.r);
        bets[sid] = bets[sid] === r ? null : r;
        Sound.tick(); renderBets();
      });
      const n = Object.values(bets).filter((v) => v !== null && v !== undefined).length;
      sh.info(`每個人可以押 1 隻（用 1 張入場券）。已經有 ${n} 人押好了。`);
      sh.actions(`<button class="go${n ? '' : ' off'}" id="rcGo">開跑！</button>`).querySelector('#rcGo').onclick = run;
    }
    async function run() {
      if (sh.busy) return;
      const list = W.cls().students;
      const entries = list.filter((s) => bets[s.id] !== null && bets[s.id] !== undefined && (s.zoneTickets || 0) > 0);
      if (!entries.length) { W.toast('還沒有人押注', false); return; }
      W.snapshot('小動物賽跑');
      entries.forEach((s) => {
        s.zoneTickets -= 1;
        const rc = RACERS[bets[s.id]];
        Research.decide(s, '小動物賽跑', `押${rc.name}`, { p: rc.p, prize: rc.x * price(), cost: price(), note: s.id === student.id ? '開這一場的人' : '一起押的同學' });
      });
      W.save();
      sh.setBusy(true); sh.sub();
      // 先決定誰贏（照機率），再演出比賽
      let r = Math.random() * 100, win = RACERS.length - 1;
      for (let i = 0; i < RACERS.length; i++) { r -= RACERS[i].p; if (r < 0) { win = i; break; } }
      sh.stage.innerHTML = `<div class="rc-track">${RACERS.map((rc, i) => `<div class="lane"><span class="ln">${i + 1}</span><div class="runner" id="rn${i}">${rc.e}</div><div class="finish"></div><div class="backers">${entries.filter((s) => bets[s.id] === i).map((s) => Avatar.html(s, 22)).join('')}</div></div>`).join('')}</div><div class="rc-comment" id="rcCmt">預備…</div>`;
      sh.actions('');
      sh.info('');
      const cmt = sh.stage.querySelector('#rcCmt');
      for (const w of ['3', '2', '1', '跑！']) { cmt.textContent = w; Sound.tick(); await sleep(450); }
      const T = 7000;
      const finish = RACERS.map((_, i) => (i === win ? T : T + 250 + Math.random() * 1600));
      const phase = RACERS.map(() => Math.random() * 6);
      const t0 = performance.now();
      let leader = -1, lastStep = 0;
      const stop = FX.suspense(sh.root, T);
      await new Promise((res) => {
        const frame = (now) => {
          if (sh.closed) { res(); return; }
          const t = now - t0;
          const pos = RACERS.map((_, i) => {
            const base = Math.min(1, t / finish[i]);
            const wob = 0.06 * Math.sin(t / 420 + phase[i]) * Math.sin(Math.min(1, t / finish[i]) * Math.PI);
            return Math.max(0, Math.min(1, base + wob));
          });
          pos.forEach((p, i) => { const el = sh.stage.querySelector('#rn' + i); if (el) el.style.left = `calc(${(p * 86).toFixed(2)}% + 24px)`; });
          const lead = pos.indexOf(Math.max(...pos));
          if (lead !== leader && t > 600) { leader = lead; cmt.textContent = `${RACERS[lead].e} ${RACERS[lead].name}領先！`; Sound.tick(); }
          if (now - lastStep > 220) { Sound.rattle(); lastStep = now; }
          if (t < T + 400) requestAnimationFrame(frame); else res();
        };
        requestAnimationFrame(frame);
      });
      stop();
      if (sh.closed) return;
      cmt.textContent = `🏆 ${RACERS[win].e} ${RACERS[win].name}贏了！`;
      const winners = [];
      entries.forEach((s) => {
        const hit = bets[s.id] === win;
        const prize = hit ? RACERS[win].x * price() : 0;
        record(s, '小動物賽跑', 1, prize, { racer: RACERS[bets[s.id]].name, winner: RACERS[win].name });
        if (hit) winners.push(`${esc(s.name)} +${prize}`);
      });
      FX.win(sh.root, winners.length ? (RACERS[win].x >= 6 ? 'big' : 'small') : 'miss', sh.root.querySelector('.fx-behind'));
      sh.sub();
      await sleep(900);
      sh.setBusy(false);
      sh.result(`${RACERS[win].e} ${RACERS[win].name}贏了！`, winners.length > 0, [
        winners.length ? `押中的人：${winners.join('、')}` : '這次沒有人押中',
        `${RACERS[win].name}的勝率大約 ${RACERS[win].p}%，${RACERS[win].x >= 6 ? '是冷門爆冷！' : '是熱門之一'}`
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
    const LV = { easy: { up: 1150, gap: 650, name: '簡單' }, normal: { up: 850, gap: 500, name: '普通' }, hard: { up: 620, gap: 380, name: '困難' } };
    const DUR = 20000;
    let hits = 0, timers = [], running = false;
    function intro() {
      sh.stage.innerHTML = `<div class="mo-intro"><div class="mo-big">🔨</div><div>20 秒內打越多地鼠越好！金色地鼠 +3</div><div>每打中 ${Math.max(1, Number(A().molePer) || 2)} 隻得 1 點</div></div>`;
      const acts = sh.actions(Object.entries(LV).map(([k, v]) => `<button class="go small" data-lv="${k}">${v.name}</button>`).join(''));
      acts.querySelectorAll('[data-lv]').forEach((b) => b.onclick = () => start(b.dataset.lv));
      sh.info('選難度開始（用 1 張入場券）');
    }
    function start(lv) {
      if (sh.busy || running) return;
      if (!spend(student, 1, '打地鼠')) return;
      Research.decide(student, '打地鼠', LV[lv].name, { cost: price() });
      sh.sub(); hits = 0; running = true; sh.setBusy(true);
      sh.actions('');
      sh.info('點冒出來的地鼠！');
      sh.stage.innerHTML = `<div class="mo"><div class="mo-hud"><span>🔨 <b id="moHits">0</b></span><div class="mo-time"><i id="moBar"></i></div></div>
        <div class="mo-grid">${Array.from({ length: 9 }, (_, i) => `<div class="hole" data-h="${i}"><div class="mole"></div></div>`).join('')}</div></div>`;
      const cfg = LV[lv];
      const t0 = performance.now();
      const bar = sh.stage.querySelector('#moBar');
      const tick = () => { if (!running) return; const p = Math.min(1, (performance.now() - t0) / DUR); bar.style.width = (100 - p * 100) + '%'; if (p < 1) timers.push(requestAnimationFrame(tick)); };
      tick();
      const pop = () => {
        if (!running) return;
        const holes = [...sh.stage.querySelectorAll('.hole:not(.up)')];
        if (holes.length) {
          const h = holes[Math.floor(Math.random() * holes.length)];
          const gold = Math.random() < 0.1;
          h.classList.add('up'); h.classList.toggle('gold', gold);
          h.querySelector('.mole').textContent = gold ? '🌟' : '🐹';
          const down = setTimeout(() => h.classList.remove('up', 'gold', 'hit'), cfg.up);
          timers.push(down);
        }
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
        setTimeout(() => h.classList.remove('up', 'gold', 'hit'), 180);
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
    savingsHTML, saveTicket, claimSaving, plinkoPrizes, plinkoEV
  };
})();
