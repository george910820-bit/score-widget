// 共用特效：等待特效、點擊回饋（加油能量條）、中獎背光（小獎／大獎）
// 點擊回饋只是「幫他加油」，不會改變結果，畫面上也不暗示會改變結果
window.FX = (() => {
  'use strict';

  function ensure(root) {
    if (root.__fx) return root.__fx;
    const layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.innerHTML = `
      <canvas class="fx-canvas"></canvas>
      <div class="fx-flash"></div>
      <div class="fx-title hidden"></div>
      <div class="fx-cheer hidden">加油！</div>
      <div class="fx-energy hidden"><span>幫他加油</span><div class="fx-bar"><i></i></div></div>`;
    root.appendChild(layer);
    const st = {
      root, layer, cv: layer.querySelector('.fx-canvas'), parts: [], raf: 0,
      waiting: false, energy: 0, orbit: 0, coins: 0, w: 0, h: 0, last: performance.now()
    };
    st.g = st.cv.getContext('2d');
    root.addEventListener('pointerdown', (e) => { if (st.waiting) tap(st, e); }, true);
    root.__fx = st;
    resize(st);
    return st;
  }

  function resize(st) {
    const dpr = window.devicePixelRatio || 1;
    st.w = st.layer.clientWidth; st.h = st.layer.clientHeight;
    st.cv.width = st.w * dpr; st.cv.height = st.h * dpr;
    st.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function run(st) {
    if (st.raf) return;
    st.last = performance.now();
    const frame = (now) => {
      const dt = Math.min(2.5, (now - st.last) / 16.67);
      st.last = now;
      if (st.w !== st.layer.clientWidth || st.h !== st.layer.clientHeight) resize(st);
      const g = st.g;
      g.clearRect(0, 0, st.w, st.h);
      // 等待時：星光繞著中間轉
      if (st.orbit > 0 && Math.random() < 0.5 * dt) {
        const a = Math.random() * Math.PI * 2, r = Math.min(st.w, st.h) * (0.28 + Math.random() * 0.18);
        st.parts.push({ k: 'orb', a, r, va: 0.02 + Math.random() * 0.02, life: 1, decay: 0.012, size: 2 + Math.random() * 3, c: Math.random() < 0.5 ? '#ffe9a8' : '#ffffff' });
      }
      // 大獎：金幣雨
      if (st.coins > 0) {
        st.coins -= dt;
        if (Math.random() < 0.6 * dt) st.parts.push({ k: 'coin', x: Math.random() * st.w, y: -20, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, spin: Math.random() * 6, life: 1, decay: 0.004, size: 9 + Math.random() * 7 });
      }
      st.parts = st.parts.filter((p) => p.life > 0);
      st.parts.forEach((p) => {
        p.life -= p.decay * dt;
        g.globalAlpha = Math.max(0, Math.min(1, p.life));
        if (p.k === 'spark') {
          p.vy += 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.size * p.life + 0.5, 0, Math.PI * 2); g.fill();
        } else if (p.k === 'ring') {
          p.r += 3.2 * dt;
          g.strokeStyle = p.c; g.lineWidth = 4 * p.life; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.stroke();
        } else if (p.k === 'orb') {
          p.a += p.va * dt;
          const x = st.w / 2 + Math.cos(p.a) * p.r, y = st.h * 0.45 + Math.sin(p.a) * p.r * 0.8;
          g.fillStyle = p.c; star(g, x, y, p.size * (0.6 + Math.sin(p.life * 12) * 0.4));
        } else if (p.k === 'coin') {
          p.vy += 0.05 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.spin += 0.15 * dt;
          if (p.y > st.h + 30) p.life = 0;
          const sx = Math.abs(Math.cos(p.spin));
          g.fillStyle = '#f5b82e'; g.beginPath(); g.ellipse(p.x, p.y, p.size * sx + 1, p.size, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ffe08a'; g.beginPath(); g.ellipse(p.x - p.size * 0.2 * sx, p.y - p.size * 0.2, p.size * 0.45 * sx + 0.5, p.size * 0.45, 0, 0, Math.PI * 2); g.fill();
        }
      });
      g.globalAlpha = 1;
      if (st.parts.length || st.orbit > 0 || st.coins > 0) st.raf = requestAnimationFrame(frame);
      else { st.raf = 0; g.clearRect(0, 0, st.w, st.h); }
    };
    st.raf = requestAnimationFrame(frame);
  }

  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r * 1.4;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }

  function burst(st, x, y, n, colors, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
      st.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, decay: 0.022 + Math.random() * 0.02, size: 2 + Math.random() * 3, c: colors[i % colors.length] });
    }
    run(st);
  }

  // 等待時點一下：光圈、星星、輕震、音效，能量條往上加
  function tap(st, e) {
    const r = st.layer.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    st.parts.push({ k: 'ring', x, y, r: 6, life: 1, decay: 0.05, c: '#ffe08a' });
    burst(st, x, y, 12, ['#ffe08a', '#ffffff', '#ff9ec7', '#9ee7ff'], 5);
    Sound.tap(st.energy);
    st.root.classList.remove('fx-shake'); void st.root.offsetWidth; st.root.classList.add('fx-shake');
    st.energy = Math.min(1, st.energy + 0.12);
    setBar(st);
    if (st.energy >= 1) {
      const c = st.layer.querySelector('.fx-cheer');
      c.classList.remove('hidden', 'pop'); void c.offsetWidth; c.classList.add('pop');
      setTimeout(() => c.classList.add('hidden'), 900);
      burst(st, st.w / 2, st.h * 0.4, 50, ['#ffd54f', '#ff8a65', '#81d4fa', '#ffffff'], 9);
      Sound.cheer();
      st.energy = 0;
      setTimeout(() => setBar(st), 250);
    }
  }
  function setBar(st) { st.layer.querySelector('.fx-bar i').style.width = Math.round(st.energy * 100) + '%'; }

  // 開始等待：星光、能量條、點擊回饋、等待音效。回傳停止的函式
  function suspense(root, ms) {
    const st = ensure(root);
    st.waiting = true; st.orbit = 1; st.energy = 0; setBar(st);
    st.layer.querySelector('.fx-energy').classList.remove('hidden');
    root.classList.add('fx-waiting');
    const stopSound = Sound.suspense(ms);
    run(st);
    let done = false;
    return () => {
      if (done) return; done = true;
      stopSound();
      st.waiting = false; st.orbit = 0;
      root.classList.remove('fx-waiting');
      st.layer.querySelector('.fx-energy').classList.add('hidden');
    };
  }

  // 結果特效：big（大獎）、small（小獎）、miss（沒中）
  function win(root, tier, behind) {
    const st = ensure(root);
    clear(root);
    const fl = st.layer.querySelector('.fx-flash');
    if (tier === 'miss') { Sound.zero(); return; }
    if (behind) {
      const rays = document.createElement('div');
      rays.className = 'fx-rays ' + tier;
      behind.appendChild(rays);
      st.rays = rays;
    }
    fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    if (tier === 'big') {
      root.classList.add('fx-big');
      const t = st.layer.querySelector('.fx-title');
      t.innerHTML = '<span>🏆 大獎！</span>';
      t.classList.remove('hidden', 'pop'); void t.offsetWidth; t.classList.add('pop');
      st.coins = 200;
      burst(st, st.w / 2, st.h * 0.45, 90, ['#ffd54f', '#ffe08a', '#ffffff', '#f5b82e'], 12);
      Sound.jackpot();
      if (window.Lottery) Lottery.confetti(240);
    } else {
      burst(st, st.w / 2, st.h * 0.45, 50, ['#ffd54f', '#ffffff', '#81d4fa', '#a5d6a7'], 9);
      Sound.win();
      if (window.Lottery) Lottery.confetti(100);
    }
    run(st);
  }

  function clear(root) {
    const st = root.__fx;
    if (!st) return;
    if (st.rays) { st.rays.remove(); st.rays = null; }
    root.classList.remove('fx-big');
    st.layer.querySelector('.fx-title').classList.add('hidden');
    st.coins = 0;
  }

  return { suspense, win, clear, burst: (root, x, y, n, c) => burst(ensure(root), x, y, n, c) };
})();
