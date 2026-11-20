// 吃角子老虎機（拉霸）：學生自己選押注大小，體驗機率與機會成本
// 圖案用台灣小吃；拉之前用圖示顯示「10 次大約中幾次」；不做「差一點就中」的誘導畫面
window.Slot = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYMS = ['🥟', '🧋', '🍜', '🍢', '🍧', '🍗'];
  const SYM_NAME = { '🥟': '餃子', '🧋': '珍奶', '🍜': '牛肉麵', '🍢': '黑輪', '🍧': '剉冰', '🍗': '雞排' };
  const rnd = () => SYMS[Math.floor(Math.random() * SYMS.length)];
  const S = () => W.data.settings.slot;

  let cur = null; // { student, bet, busy, root, reels }

  function open(student) {
    close();
    const root = document.createElement('div');
    root.className = 'slot-overlay';
    root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(student, 40)}<div><b>${esc(student.name)}</b><div class="lotto-sub" id="slotSub"></div></div></div>
        <div class="slot-title">🎰 吃角子老虎機</div>
        <button class="icon-btn lotto-x" id="slotClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="slot-main" id="slotMain">
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
      if (b.classList.contains('no')) { W.toast('點數不夠，不能押這個', false); Sound.minus(); return; }
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
        <div class="bc">保留 ⭐ ${s.score} 點</div>
        <div class="bd">點數不會少，也不會多</div>
      </button>`;
    cur.root.querySelector('#slotBets').innerHTML = keep + bets.map((b) => {
      const n = Math.round(b.chance / 10);
      const icons = Array.from({ length: 10 }, (_, i) => `<span class="${i < n ? 'on' : ''}">${b.sym}</span>`).join('');
      const no = s.score < b.cost;
      return `
      <button class="bet${cur.bet === b.id ? ' sel' : ''}${no ? ' no' : ''}" data-bet="${b.id}">
        <div class="bt">${b.sym} ${esc(b.name)}</div>
        <div class="bc">花 ${b.cost} 點</div>
        <div class="bp" title="機率 ${b.chance}%">${icons}</div>
        <div class="bd">10 次大約中 ${n} 次</div>
        <div class="bw">中了拿 ${b.prize} 點</div>
        ${no ? '<div class="bno">點數不夠</div>' : ''}
      </button>`;
    }).join('');
    cur.root.querySelector('#slotSub').textContent = `⭐ ${s.score}`;
    const go = cur.root.querySelector('#slotGo');
    const bet = bets.find((b) => b.id === cur.bet);
    go.classList.toggle('off', !cur.bet);
    go.textContent = !cur.bet ? '先選一個' : cur.bet === 'keep' ? '就保留，不拉了' : `拉！（花 ${bet.cost} 點）`;
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
      const filler = Array.from({ length: 18 + i * 7 }, rnd);
      const arr = [...next, ...filler, ...now];
      st.style.transition = 'none';
      st.innerHTML = stripHTML(arr);
      const rowH = st.firstElementChild.getBoundingClientRect().height;
      st.style.transform = `translateY(${-(arr.length - 3) * rowH}px)`;
      void st.offsetHeight;
      const dur = 1.3 + i * 0.6 + (i === 2 ? 0.7 : 0);
      st.style.transition = `transform ${dur}s cubic-bezier(.12,.75,.25,1.03)`;
      st.style.transform = 'translateY(0)';
      cur.syms[i] = next;
      jobs.push(sleep(dur * 1000).then(() => Sound.reelStop()));
      if (i === 2) setTimeout(() => { if (cur) Sound.suspense(1200); }, (1.3 + 0.6 * 1) * 1000);
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
    if (s.score < bet.cost) { W.toast('點數不夠，不能押這個', false); return; }
    W.snapshot(`${s.name} 拉霸`);
    const win = Math.random() < bet.chance / 100;
    const before = s.score;
    s.score = s.score - bet.cost + (win ? bet.prize : 0);
    const delta = s.score - before;
    W.data.history.push({
      t: new Date().toISOString(), type: 'slot', classId: W.cls().id, studentId: s.id, name: s.name,
      delta, score: s.score, item: bet.name, cost: bet.cost, win, prize: win ? bet.prize : 0, chance: bet.chance
    });
    W.save();
    cur.busy = true;
    const root = cur.root;
    root.classList.add('busy', 'spinning');
    root.querySelector('#slotResult').classList.add('hidden');
    root.querySelector('#slotSub').textContent = `⭐ ${before - bet.cost}（花了 ${bet.cost} 點）`;
    let targets;
    if (win) targets = [bet.sym, bet.sym, bet.sym];
    else do { targets = [rnd(), rnd(), rnd()]; } while (targets[0] === targets[1] && targets[1] === targets[2]);
    await spinReels(targets);
    if (!cur || cur.root !== root) { W.renderAll(); return; }
    root.classList.remove('spinning');
    if (win) { root.classList.add('win'); Sound.coins(); setTimeout(() => Sound.win(), 300); Lottery.confetti(bet.prize >= 10 ? 220 : 120); } else Sound.zero();
    W.renderAll();
    await sleep(900);
    if (!cur || cur.root !== root) return;
    root.classList.remove('busy', 'win');
    cur.busy = false;
    showResult({ bet, win, before, after: s.score, targets });
  }

  function showResult(r) {
    const box = cur.root.querySelector('#slotResult');
    const lines = r.win
      ? [`花 ${r.bet.cost} 點，拿到 ${r.bet.prize} 點`, `比不拉多了 ${r.bet.prize - r.bet.cost} 點`]
      : [`花掉的 ${r.bet.cost} 點拿不回來`, `如果剛剛選「不拉」，現在會有 ⭐ ${r.before} 點`];
    lines.push(`現在 ⭐ ${r.after}`);
    box.innerHTML = `
      <div class="res-big ${r.win ? 'hit' : 'miss'}" style="--c:#d62e3a">${r.win ? `${r.targets.join('')} 中了！` : '沒中…'}</div>
      <div class="res-lines">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="btn-row center"><button id="slotAgain" class="primary">再選一次</button><button id="slotEnd">結束</button></div>`;
    box.classList.remove('hidden');
    box.querySelector('#slotAgain').onclick = () => { box.classList.add('hidden'); cur.bet = null; renderBets(); };
    box.querySelector('#slotEnd').onclick = close;
    renderBets();
  }

  // 選「不拉」也是一種選擇，記錄下來
  function keepPoints() {
    const s = cur.student;
    W.data.history.push({ t: new Date().toISOString(), type: 'slot', classId: W.cls().id, studentId: s.id, name: s.name, delta: 0, score: s.score, item: '不拉', cost: 0, win: false, prize: 0, keep: true });
    W.save();
    const box = cur.root.querySelector('#slotResult');
    box.innerHTML = `
      <div class="res-big hit" style="--c:#2e9d5b">保留點數 👍</div>
      <div class="res-lines"><div>你選擇不拉，⭐ ${s.score} 點都留著</div><div>可以存起來換獎勵</div></div>
      <div class="btn-row center"><button id="slotEnd" class="primary">好！</button></div>`;
    box.classList.remove('hidden');
    box.querySelector('#slotEnd').onclick = close;
    Sound.ticket();
  }

  function close() {
    if (!cur) return;
    cur.root.remove();
    cur = null;
    window.removeEventListener('resize', layout);
    W.renderAll();
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
