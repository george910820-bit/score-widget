// 遊樂場：用點數換入場券，再用入場券玩吃角子老虎機或刮刮樂；老師可以開關
window.Zone = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const Z = () => W.data.settings.zone;
  const price = () => Number(Z().price) || 10;
  let cur = null;
  const GAME_LIST = [
    { id: 'slot', ic: '🎰', name: '吃角子老虎機', kind: 'luck', desc: '押 1～3 張，押越大獎越大、越難中' },
    { id: 'scratch', ic: '🎫', name: '刮刮樂', kind: 'luck', desc: '刮出 3 個一樣就中獎' },
    { id: 'plinko', ic: '🚀', name: '彈珠台', kind: 'luck', desc: '太空彈珠台！發射珠子，看會掉進哪一格' },
    { id: 'claw', ic: '🧸', name: '夾娃娃機', kind: 'luck', desc: '自己移動爪子夾娃娃' },
    { id: 'hilo', ic: '🃏', name: '猜大小', kind: 'luck', desc: '猜對獎金翻倍，見好就收' },
    { id: 'race', ic: '🏁', name: '小動物賽跑', kind: 'luck', desc: '全班一起押，冷門獎比較大' },
    { id: 'mole', ic: '🔨', name: '打地鼠', kind: 'skill', desc: '20 秒，越來越快，最後 10 秒超快！' },
    { id: 'memory', ic: '🧠', name: '翻牌記憶配對', kind: 'skill', desc: '翻錯越少，分數越多' },
    { id: 'kart', ic: '🏎️', name: '虎尾大賽車', kind: 'skill', desc: '2～4 人大屏對戰！每人 2 張，前三名分獎池' }
  ];

  function open(student, returning) {
    close(true);
    if (!returning) Research.enter(student);
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
        <div class="slot-title">🎡 遊樂場</div>
        <button class="icon-btn lotto-x" id="zClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="zone-body">
        ${open ? `
        <div class="z-tickets">
          <div class="z-ticket-big"><span class="z-ic">🎟</span><div><div class="z-num">${t}</div><div class="z-lbl">入場券</div></div></div>
          <div class="z-buy">
            <button id="zBuy" class="${canBuy ? 'primary' : 'off'}">用 ${p} 點換 1 張</button>
            <button id="zBook" class="z-book">📒 收藏冊 <b>${Object.keys(s.plush || {}).length}</b></button>
            <div class="z-hint">${canBuy ? `換了以後剩 ⭐ ${s.score - p} 點` : `點數不夠（要 ${p} 點）`}${rp && !rp.can ? `<br>不換的話：${esc(rp.text)}` : ''}</div>
          </div>
        </div>
        <div class="z-games">
          ${GAME_LIST.map((g) => `<button class="z-game${t >= 1 ? '' : ' off'}" data-game="${g.id}">
            <div class="zg-ic">${g.ic}</div><div class="zg-name">${g.name}</div><div class="zg-tag ${g.kind}">${g.kind === 'luck' ? '機率' : '技巧'}</div><div class="zg-desc">${g.desc}</div>
          </button>`).join('')}
        </div>
        ${Arcade.savingsHTML(s)}
        <p class="z-note">每張入場券值 ${p} 點。點數也可以存起來換獎勵，想清楚再換喔！</p>` : `
        <div class="z-closed"><div class="zc-ic">😴</div><div class="zc-t">遊樂場休息中</div><div class="zc-d">等老師打開才能玩</div>
          <div class="z-ticket-small">你有 🎟 入場券 ${t} 張</div></div>`}
      </div>`;
    cur.root.querySelector('#zClose').onclick = () => close();
    const buy = cur.root.querySelector('#zBuy');
    if (buy) buy.onclick = buyTicket;
    const bk = cur.root.querySelector('#zBook');
    if (bk) bk.onclick = () => Arcade.openBook(cur.student, cur.root);
    cur.root.querySelectorAll('[data-game]').forEach((b) => b.onclick = () => play(b.dataset.game));
    const sv = cur.root.querySelector('#svSave');
    if (sv) sv.onclick = () => { if (Arcade.saveTicket(cur.student)) { render(); W.renderAll(); } };
    cur.root.querySelectorAll('[data-claim]').forEach((b) => b.onclick = () => { Arcade.claimSaving(cur.student, b.dataset.claim, false); render(); W.renderAll(); });
    cur.root.querySelectorAll('[data-early]').forEach(async (b) => b.onclick = async () => {
      if (!(await W.confirm('提早拿回只能拿回 1 張入場券；等到期可以領回 2 張。確定要提早拿嗎？', '提早拿回'))) return;
      Arcade.claimSaving(cur.student, b.dataset.early, true); render(); W.renderAll();
    });
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
    Research.buy(s, p, rp && !rp.can ? `換之前：${rp.text}` : (rp ? '換之前已經可以換獎勵' : ''));
    W.data.history.push({ t: new Date().toISOString(), type: 'zone-ticket', classId: W.cls().id, studentId: s.id, name: s.name, delta: -p, score: s.score, item: '換入場券 1 張' });
    W.save();
    Sound.bigTicket();
    render();
    const r = cur.root.getBoundingClientRect(), b = cur.root.querySelector('.z-ticket-big').getBoundingClientRect();
    // 入場券從畫面中間跳出來，再飛進票夾
    const fly = document.createElement('div');
    fly.className = 'tk-fly';
    fly.style.setProperty('--tx', `${b.left - r.left + b.width / 2 - r.width / 2}px`);
    fly.style.setProperty('--ty', `${b.top - r.top + b.height / 2 - r.height / 2}px`);
    fly.innerHTML = '<div class="tk-rays"></div><div class="tk-card"><span>🎟</span><b>+1</b></div><div class="tk-txt">入場券到手！</div>';
    cur.root.appendChild(fly);
    const root = cur.root;
    FX.burst(root, r.width / 2, r.height / 2, 60, ['#ffd54f', '#ffffff', '#ff8a65', '#69f0ae']);
    setTimeout(() => { FX.burst(root, b.left - r.left + b.width / 2, b.top - r.top + b.height / 2, 30, ['#ffd54f', '#ffffff', '#ff8a65']); const big = root.querySelector('.z-ticket-big'); if (big) { big.classList.remove('bump'); void big.offsetWidth; big.classList.add('bump'); } }, 1250);
    setTimeout(() => fly.remove(), 1700);
    W.renderAll();
  }

  function play(game) {
    const s = cur.student;
    if (game !== 'kart' && (s.zoneTickets || 0) < 1) { W.toast('先用點數換入場券', false); Sound.minus(); return; }
    Research.pick(s, (GAME_LIST.find((g) => g.id === game) || {}).name || game);
    close(true);
    const back = (st) => { if (Z().on) open(st, true); else Research.leave(st); };
    if (game === 'slot') Slot.open(s, back);
    else if (game === 'scratch') Scratch.open(s, back);
    else Arcade.open(game, s, back);
  }

  function close(silent) {
    if (!cur) return;
    if (!silent) Research.leave(cur.student);
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
