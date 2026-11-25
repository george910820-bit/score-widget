// 吃角子老虎機（拉霸）：在遊樂場用入場券押注，學生自己選押注大小，體驗機率與機會成本
// 圖案用台灣小吃；拉之前用圖示顯示「10 次大約中幾次」；不做「差一點就中」的誘導畫面
window.Slot = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYMS = ['🥟', '🧋', '🍜', '🍢', '🍧', '🍗'];
  const SYM_NAME = { '🥟': '餃子', '🧋': '珍奶', '🍜': '牛肉麵', '🍢': '黑輪', '🍧': '剉冰', '🍗': '雞排' };
  const rnd = () => SYMS[Math.floor(Math.random() * SYMS.length)];
  const S = () => W.data.settings.slot;
  const price = () => Number(W.data.settings.zone.price) || 10;

  let cur = null; // { student, bet, busy, root, reels }

  let onCloseCb = null;
  function open(student, onClose) {
    close();
    onCloseCb = onClose || null;
    const root = document.createElement('div');
    root.className = 'slot-overlay';
    root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(student, 40)}<div><b>${esc(student.name)}</b><div class="lotto-sub" id="slotSub"></div></div></div>
        <div class="slot-title">🎰 吃角子老虎機</div>
        <button class="icon-btn lotto-x" id="slotClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="slot-main" id="slotMain"><div class="fx-behind"></div>
        <div class="slot-cab" id="slotCab">
          <div class="slot-sign"><div class="bulbs">${'<i></i>'.repeat(11)}</div><div class="slot-name">吃角子老虎機</div></div>
          <div class="slot-window">
            ${[0, 1, 2].map((i) => `<div class="reel"><div class="strip" id="strip${i}"></div></div>`).join('')}
            <div class="payline"></div>
          </div>
          <div class="slot-tray"><span>🪙</span></div>
          <div class="lever" id="slotLever" title="選好押注後，往下拉！">
            <div class="lever-rod"></div><div class="lever-knob" id="slotKnob"></div><div class="lever-base"></div>
          </div>
        </div>
        <div class="bets" id="slotBets"></div>
      </div>
      <div class="lotto-info" id="slotInfo">先選要「不拉」還是押哪一個，再拉右邊的拉桿！</div>
      <div class="lotto-actions"><button class="go off" id="slotGo">先選一個</button></div>
      <div class="lotto-result hidden" id="slotResult"></div>`;
    document.body.appendChild(root);
    cur = { student, bet: null, busy: false, root, syms: [[rnd(), rnd(), rnd()], [rnd(), rnd(), rnd()], [rnd(), rnd(), rnd()]] };
    root.querySelector('#slotClose').onclick = close;
    root.querySelector('#slotGo').onclick = goBtn;
    root.querySelector('#slotBets').onclick = (e) => {
      const b = e.target.closest('[data-bet]');
      if (!b || cur.busy) return;
      if (b.classList.contains('no')) { W.toast('入場券不夠，不能押這個', false); Sound.minus(); return; }
      cur.bet = b.dataset.bet;
      Sound.tick();
      renderBets();
    };
    setupLever();
    renderReelsStatic();
    renderBets();
    Sound.unlock();
    requestAnimationFrame(layout);
    window.addEventListener('resize', layout);
  }

  // 依視窗大小排版：寬螢幕機器在左、押注在右；窄視窗上下排
  function layout() {
    if (!cur) return;
    const main = cur.root.querySelector('#slotMain');
    const cab = cur.root.querySelector('#slotCab');
    const bets = cur.root.querySelector('#slotBets');
    const W0 = main.clientWidth, H0 = main.clientHeight;
    const wide = W0 > H0 * 1.25;
    main.classList.toggle('wide', wide);
    const br = bets.getBoundingClientRect();
    const remW = wide ? W0 - br.width - 24 : W0 - 8;
    const remH = wide ? H0 - 8 : H0 - br.height - 16;
    const cw = Math.max(150, Math.min(remW / 1.2, remH / 1.0, 560));
    cab.style.setProperty('--u', (cw / 100) + 'px');
    cab.style.width = cw + 'px';
  }

  function renderBets() {
    const s = cur.student;
    const bets = S().bets;
    const keep = `
      <button class="bet keep${cur.bet === 'keep' ? ' sel' : ''}" data-bet="keep">
        <div class="bt">🙅 不拉</div>
        <div class="bc">入場券 🎟 ${s.zoneTickets || 0} 張都留著</div>
        <div class="bd">不會少，也不會多</div>
      </button>`;
    cur.root.querySelector('#slotBets').innerHTML = keep + bets.map((b) => {
      const n = Math.round(b.chance / 10);
      const icons = Array.from({ length: 10 }, (_, i) => `<span class="${i < n ? 'on' : ''}">${b.sym}</span>`).join('');
      const no = (s.zoneTickets || 0) < b.cost;
      return `
      <button class="bet${cur.bet === b.id ? ' sel' : ''}${no ? ' no' : ''}" data-bet="${b.id}">
        <div class="bt">${b.sym} ${esc(b.name)}</div>
        <div class="bc">用 ${b.cost} 張入場券</div>
        <div class="bp" title="機率 ${b.chance}%">${icons}</div>
        <div class="bd">10 次大約中 ${n} 次</div>
        <div class="bw">中了拿 ${b.prize} 點</div>
        ${no ? '<div class="bno">入場券不夠</div>' : ''}
      </button>`;
    }).join('');
    cur.root.querySelector('#slotSub').textContent = `⭐ ${s.score}・🎟 入場券 ${s.zoneTickets || 0} 張`;
    const go = cur.root.querySelector('#slotGo');
    const bet = bets.find((b) => b.id === cur.bet);
    go.classList.toggle('off', !cur.bet);
    go.textContent = !cur.bet ? '先選一個' : cur.bet === 'keep' ? '不拉了，回遊樂場' : `拉！（用 ${bet.cost} 張）`;
    cur.root.querySelector('#slotLever').classList.toggle('ready', !!bet);
    requestAnimationFrame(layout);
  }

  // ---------- 轉輪 ----------
  function stripHTML(arr) { return arr.map((x) => `<div class="sym">${x}</div>`).join(''); }
  function renderReelsStatic() {
    for (let i = 0; i < 3; i++) {
      const st = cur.root.querySelector('#strip' + i);
      st.style.transition = 'none';
      st.style.transform = 'translateY(0)';
      st.innerHTML = stripHTML(cur.syms[i]);
    }
  }

  // 轉輪往下轉，停在目標圖案
  async function spinReels(targets) {
    const ticks = setInterval(() => Sound.tick(), 75);
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      const st = cur.root.querySelector('#strip' + i);
      const now = cur.syms[i];
      const next = [rnd(), targets[i], rnd()];
      const filler = Array.from({ length: 26 + i * 14 + (i === 2 ? 18 : 0) }, rnd);
      const arr = [...next, ...filler, ...now];
      st.style.transition = 'none';
      st.innerHTML = stripHTML(arr);
      const rowH = st.firstElementChild.getBoundingClientRect().height;
      st.style.transform = `translateY(${-(arr.length - 3) * rowH}px)`;
      void st.offsetHeight;
      const dur = [2.4, 4.0, 9.0][i];
      st.style.transition = i === 2 ? `transform ${dur}s cubic-bezier(.1,.55,.06,1)` : `transform ${dur}s cubic-bezier(.12,.75,.25,1.03)`;
      st.style.transform = 'translateY(0)';
      cur.syms[i] = next;
      jobs.push(sleep(dur * 1000).then(() => { Sound.reelStop(); const r = cur && cur.root.querySelectorAll('.reel')[i]; if (r) { r.classList.add('stopped'); } }));
    }
    await Promise.all(jobs);
    clearInterval(ticks);
  }

  // ---------- 拉桿 ----------
  function setupLever() {
    const lever = cur.root.querySelector('#slotLever');
    const knob = cur.root.querySelector('#slotKnob');
    let drag = null;
    const maxPull = () => lever.clientHeight * 0.62;
    const setPos = (y, anim) => {
      knob.style.transition = anim ? 'transform .35s cubic-bezier(.3,1.6,.5,1)' : 'none';
      knob.style.transform = `translate(-50%, ${y}px)`;
      const rod = lever.querySelector('.lever-rod');
      rod.style.transition = knob.style.transition;
      rod.style.transform = `scaleY(${1 - y / lever.clientHeight * 0.9})`;
    };
    lever.onpointerdown = (e) => {
      if (!cur || cur.busy) return;
      drag = { y0: e.clientY, pos: 0 };
      lever.setPointerCapture(e.pointerId);
      Sound.unlock();
    };
    lever.onpointermove = (e) => {
      if (!drag) return;
      drag.pos = Math.max(0, Math.min(maxPull(), e.clientY - drag.y0));
      setPos(drag.pos, false);
    };
    lever.onpointerup = lever.onpointercancel = () => {
      if (!drag) return;
      const pulled = drag.pos > maxPull() * 0.6;
      const tap = drag.pos < 4;
      drag = null;
      if (pulled || tap) {
        if (!checkBet()) { setPos(0, true); return; }
        if (tap) { setPos(maxPull(), true); setTimeout(() => setPos(0, true), 220); } else setPos(0, true);
        Sound.lever();
        spin();
      } else setPos(0, true);
    };
  }

  function checkBet() {
    if (!cur.bet) { W.toast('先選要押哪一個（或選「不拉」）', false); return false; }
    if (cur.bet === 'keep') { keepPoints(); return false; }
    return true;
  }

  function goBtn() {
    if (!cur || cur.busy) return;
    if (!checkBet()) return;
    const knob = cur.root.querySelector('#slotKnob');
    const lever = cur.root.querySelector('#slotLever');
    knob.style.transition = 'transform .2s ease-in';
    knob.style.transform = `translate(-50%, ${lever.clientHeight * 0.62}px)`;
    Sound.lever();
    setTimeout(() => { knob.style.transition = 'transform .35s cubic-bezier(.3,1.6,.5,1)'; knob.style.transform = 'translate(-50%, 0)'; }, 220);
    spin();
  }

  // ---------- 拉一次 ----------
  async function spin() {
    const s = cur.student;
    const bet = S().bets.find((b) => b.id === cur.bet);
    if (!bet || cur.busy) return;
    if ((s.zoneTickets || 0) < bet.cost) { W.toast('入場券不夠，不能押這個', false); return; }
    W.snapshot(`${s.name} 拉霸`);
    const win = Math.random() < bet.chance / 100;
    const before = s.score;
    const ticketsBefore = s.zoneTickets || 0;
    s.zoneTickets = ticketsBefore - bet.cost;
    Research.decide(s, '吃角子老虎機', bet.name, { p: bet.chance, prize: bet.prize, cost: bet.cost * price(), note: `用 ${bet.cost} 張入場券（手上原本 ${ticketsBefore} 張）` });
    s.score = s.score + (win ? bet.prize : 0);
    const delta = s.score - before;
    Research.outcome(s, '吃角子老虎機', win ? bet.prize : 0, bet.cost, '');
    W.data.history.push({
      t: new Date().toISOString(), type: 'slot', classId: W.cls().id, studentId: s.id, name: s.name,
      delta, score: s.score, item: bet.name, cost: bet.cost, tickets: bet.cost, win, prize: win ? bet.prize : 0, chance: bet.chance
    });
    W.save();
    cur.busy = true;
    const root = cur.root;
    root.classList.add('busy', 'spinning');
    root.querySelector('#slotResult').classList.add('hidden');
    root.querySelector('#slotSub').textContent = `⭐ ${before}・🎟 入場券 ${s.zoneTickets} 張（用了 ${bet.cost} 張）`;
    FX.clear(root);
    root.querySelectorAll('.reel').forEach((r) => r.classList.remove('stopped'));
    const stopWait = FX.suspense(root, 9000);
    let targets;
    if (win) targets = [bet.sym, bet.sym, bet.sym];
    else do { targets = [rnd(), rnd(), rnd()]; } while (targets[0] === targets[1] && targets[1] === targets[2]);
    await spinReels(targets);
    stopWait();
    if (!cur || cur.root !== root) { W.renderAll(); return; }
    root.classList.remove('spinning');
    // 中獎專屬特效：押最大的那一種中了＝大獎
    const maxPrize = Math.max(...S().bets.map((b) => b.prize));
    if (win) { root.classList.add('win'); Sound.coins(); FX.win(root, bet.prize >= maxPrize ? 'big' : 'small', root.querySelector('.fx-behind')); } else FX.win(root, 'miss');
    W.renderAll();
    await sleep(1100);
    if (!cur || cur.root !== root) return;
    root.classList.remove('busy', 'win');
    cur.busy = false;
    showResult({ bet, win, before, after: s.score, targets, ticketsBefore });
  }

  function showResult(r) {
    const box = cur.root.querySelector('#slotResult');
    const worth = r.bet.cost * price();
    const lines = r.win
      ? [`用了 ${r.bet.cost} 張入場券（值 ${worth} 點），拿到 ${r.bet.prize} 點`, r.bet.prize >= worth ? `比入場券的價值多了 ${r.bet.prize - worth} 點` : `比入場券的價值還少 ${worth - r.bet.prize} 點`]
      : [`用掉的 ${r.bet.cost} 張入場券（值 ${worth} 點）拿不回來`, `如果剛剛選「不拉」，入場券還會有 ${r.ticketsBefore} 張`];
    lines.push(`現在 ⭐ ${r.after}・🎟 ${cur.student.zoneTickets || 0} 張`);
    box.innerHTML = `
      <div class="res-big ${r.win ? 'hit' : 'miss'}" style="--c:#d62e3a">${r.win ? `${r.targets.join('')} 中了！` : '沒中…'}</div>
      <div class="res-lines">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="btn-row center"><button id="slotAgain" class="primary">再選一次</button><button id="slotEnd">結束</button></div>`;
    box.classList.remove('hidden');
    box.querySelector('#slotAgain').onclick = () => { box.classList.add('hidden'); FX.clear(cur.root); cur.bet = null; renderBets(); };
    box.querySelector('#slotEnd').onclick = close;
    renderBets();
  }

  // 選「不拉」也是一種選擇，記錄下來
  function keepPoints() {
    const s = cur.student;
    Research.decide(s, '吃角子老虎機', '不拉', { cost: 0, ev: 0, note: `留著 ${s.zoneTickets || 0} 張入場券` });
    W.data.history.push({ t: new Date().toISOString(), type: 'slot', classId: W.cls().id, studentId: s.id, name: s.name, delta: 0, score: s.score, item: '不拉', cost: 0, win: false, prize: 0, keep: true });
    W.save();
    const box = cur.root.querySelector('#slotResult');
    box.innerHTML = `
      <div class="res-big hit" style="--c:#2e9d5b">不拉，留著 👍</div>
      <div class="res-lines"><div>入場券 🎟 ${s.zoneTickets || 0} 張都留著</div><div>下次想玩再用</div></div>
      <div class="btn-row center"><button id="slotEnd" class="primary">好！</button></div>`;
    box.classList.remove('hidden');
    box.querySelector('#slotEnd').onclick = close;
    Sound.ticket();
  }

  function close() {
    if (!cur) return;
    const st = cur.student;
    cur.root.remove();
    cur = null;
    window.removeEventListener('resize', layout);
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
      const res = cur.root.querySelector('#slotResult');
      if (!res.classList.contains('hidden')) res.querySelector('button').click();
      else goBtn();
    }
    return true;
  }

  return { open, close, onKey, isOpen: () => !!cur, SYMS, SYM_NAME };
})();
