// 遊戲區：用點數換入場券，再用入場券玩吃角子老虎機或刮刮樂；老師可以開關
window.Zone = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const Z = () => W.data.settings.zone;
  const price = () => Number(Z().price) || 10;
  let cur = null;

  function open(student) {
    close(true);
    const root = document.createElement('div');
    root.className = 'zone-overlay';
    document.body.appendChild(root);
    cur = { student, root };
    render();
    Sound.unlock();
  }

  function render() {
    const s = cur.student;
    const t = s.zoneTickets || 0;
    const p = price();
    const open = !!Z().on;
    const rp = W.rewardProgress(s.score);
    const canBuy = s.score >= p;
    cur.root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(s, 40)}<div><b>${esc(s.name)}</b><div class="lotto-sub">⭐ ${s.score} 點</div></div></div>
        <div class="slot-title">🎪 遊戲區</div>
        <button class="icon-btn lotto-x" id="zClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="zone-body">
        ${open ? `
        <div class="z-tickets">
          <div class="z-ticket-big"><span class="z-ic">🎟</span><div><div class="z-num">${t}</div><div class="z-lbl">入場券</div></div></div>
          <div class="z-buy">
            <button id="zBuy" class="${canBuy ? 'primary' : 'off'}">用 ${p} 點換 1 張</button>
            <div class="z-hint">${canBuy ? `換了以後剩 ⭐ ${s.score - p} 點` : `點數不夠（要 ${p} 點）`}${rp && !rp.can ? `<br>不換的話：${esc(rp.text)}` : ''}</div>
          </div>
        </div>
        <div class="z-games">
          <button class="z-game${t >= 1 ? '' : ' off'}" data-game="slot">
            <div class="zg-ic">🎰</div><div class="zg-name">吃角子老虎機</div><div class="zg-desc">押 1～${Math.max(...W.data.settings.slot.bets.map((b) => b.cost))} 張入場券，押越大獎越大、越難中</div>
          </button>
          <button class="z-game${t >= 1 ? '' : ' off'}" data-game="scratch">
            <div class="zg-ic">🎫</div><div class="zg-name">刮刮樂</div><div class="zg-desc">1 張入場券刮一張，刮出 3 個一樣就中獎</div>
          </button>
        </div>
        <p class="z-note">每張入場券值 ${p} 點。點數也可以存起來換獎勵，想清楚再換喔！</p>` : `
        <div class="z-closed"><div class="zc-ic">😴</div><div class="zc-t">遊戲區休息中</div><div class="zc-d">等老師打開才能玩</div>
          <div class="z-ticket-small">你有 🎟 入場券 ${t} 張</div></div>`}
      </div>`;
    cur.root.querySelector('#zClose').onclick = () => close();
    const buy = cur.root.querySelector('#zBuy');
    if (buy) buy.onclick = buyTicket;
    cur.root.querySelectorAll('[data-game]').forEach((b) => b.onclick = () => play(b.dataset.game));
    if (cur.root.__fx) cur.root.appendChild(cur.root.__fx.layer);
  }

  async function buyTicket() {
    const s = cur.student, p = price();
    if (s.score < p) { W.toast(`點數不夠，要 ${p} 點才能換 1 張`, false); Sound.minus(); return; }
    const rp = W.rewardProgress(s.score);
    const extra = rp && !rp.can ? `\n（不換的話，${rp.text}）` : '';
    if (!(await W.confirm(`要用 ${p} 點換 1 張入場券嗎？\n換了以後剩 ⭐ ${s.score - p} 點。${extra}`, '換！'))) return;
    W.snapshot(`${s.name} 換入場券`);
    s.score -= p;
    s.zoneTickets = (s.zoneTickets || 0) + 1;
    W.data.history.push({ t: new Date().toISOString(), type: 'zone-ticket', classId: W.cls().id, studentId: s.id, name: s.name, delta: -p, score: s.score, item: '換入場券 1 張' });
    W.save();
    Sound.ticket();
    render();
    const r = cur.root.getBoundingClientRect(), b = cur.root.querySelector('.z-ticket-big').getBoundingClientRect();
    FX.burst(cur.root, b.left - r.left + b.width / 2, b.top - r.top + b.height / 2, 30, ['#ffd54f', '#ffffff', '#ff8a65']);
    W.renderAll();
  }

  function play(game) {
    const s = cur.student;
    if ((s.zoneTickets || 0) < 1) { W.toast('先用點數換入場券', false); Sound.minus(); return; }
    close(true);
    const back = (st) => { if (Z().on) open(st); };
    if (game === 'slot') Slot.open(s, back);
    else Scratch.open(s, back);
  }

  function close(silent) {
    if (!cur) return;
    cur.root.remove();
    cur = null;
    if (!silent) W.renderAll();
  }

  function onKey(e) {
    if (!cur) return false;
    if (e.key === 'Escape') close();
    return true;
  }

  return { open, close, onKey, isOpen: () => !!cur };
})();
