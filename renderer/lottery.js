// 抽獎機：每台機器各自的獎池、放回／不放回、保底、抽獎券
// 四台機器：扭蛋機、日本抽獎機（小朋友自己轉把手）、轉盤、骰子
window.Lottery = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const BALL_COLORS = ['#9aa5b1', '#2e9d5b', '#3b82f6', '#f59e0b', '#e85d75', '#8b5cf6', '#14b8a6', '#ef4444', '#f4f1ea', '#d4a017'];
  const MACHINES = [
    { id: 'gacha', name: '扭蛋機', go: '轉！' },
    { id: 'garapon', name: '日本抽獎機', go: '老師幫忙轉' },
    { id: 'wheel', name: '轉盤', go: '轉！' },
    { id: 'dice', name: '骰子', go: '擲！' }
  ];

  // ---------- 獎池計算（每台機器各自一個獎池） ----------
  const D = () => W.data;
  const L = () => D().settings.lottery;

  function poolFor(m) {
    const d = D();
    const id = (L().machinePool || {})[m];
    return d.pools.find((p) => p.id === id) || d.pools[0];
  }
  function usersOf(poolId) {
    return MACHINES.filter((x) => poolFor(x.id).id === poolId).map((x) => x.name);
  }
  function isHit(item) { return item.type === 'prize' || Number(item.points) > 0; }
  function label(item) {
    if (item.type === 'prize') return item.name || '獎品';
    const p = Number(item.points) || 0;
    return p === 0 ? '0' : (p > 0 ? '+' + p : String(p));
  }
  function shortLabel(item) { return [...label(item)].slice(0, 3).join(''); }
  // 淺色球（白色、米色）上面要用深色字
  function inkFor(hex) {
    const h = String(hex || '#999').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (r * 0.299 + g * 0.587 + b * 0.114) > 175 ? '#3b2f22' : '#ffffff';
  }

  const totalOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
  function remainAll() { const d = D(); if (!d.lotteryRemain || d.lotteryRemain.counts) d.lotteryRemain = {}; return d.lotteryRemain; }
  function refill(m) {
    const pool = poolFor(m);
    const counts = {};
    pool.items.forEach((it) => { counts[it.id] = Math.max(0, Math.round(Number(it.count) || 0)); });
    remainAll()[m] = { poolId: pool.id, counts };
  }
  function remain(m) {
    const pool = poolFor(m);
    const r = remainAll()[m];
    const valid = r && r.poolId === pool.id && r.counts && pool.items.every((it) => typeof r.counts[it.id] === 'number');
    const left = valid ? pool.items.reduce((a, it) => a + r.counts[it.id], 0) : 0;
    if (!valid || left === 0) refill(m);
    return remainAll()[m].counts;
  }
  // 獎池內容改了：用這個獎池的機器都重新裝滿
  function resetPool(poolId) {
    const all = remainAll();
    Object.keys(all).forEach((m) => { if (all[m] && all[m].poolId === poolId) delete all[m]; });
  }

  // 每一種獎項目前有幾顆（放回＝設定的顆數；不放回＝這一輪剩下的）
  function weights(m) {
    const pool = poolFor(m);
    if (L().replace) return pool.items.map((it) => ({ item: it, w: Math.max(0, Math.round(Number(it.count) || 0)) }));
    const c = remain(m);
    return pool.items.map((it) => ({ item: it, w: c[it.id] || 0 }));
  }

  function pityActive(student) {
    const l = L();
    return l.pityOn && (student.pityMiss || 0) >= Math.max(1, Number(l.pityN) || 4);
  }

  function pick(student, m) {
    let ws = weights(m).filter((x) => x.w > 0);
    if (!ws.length) return null;
    let pity = false;
    if (pityActive(student)) {
      const hits = ws.filter((x) => isHit(x.item));
      if (hits.length) { ws = hits; pity = true; }
    }
    const total = ws.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let chosen = ws[ws.length - 1].item;
    for (const x of ws) { r -= x.w; if (r < 0) { chosen = x.item; break; } }
    return { item: chosen, pity };
  }

  function canDraw(student) {
    return L().ticketMode !== 'ticket' || (student.tickets || 0) > 0;
  }

  // 抽一次並馬上記錄（就算動畫還沒播完就關掉，結果也已經存好）
  function drawAndApply(student, m) {
    const pool = poolFor(m);
    const res = pick(student, m);
    if (!res) return null;
    W.snapshot(`${student.name} 抽獎`);
    const l = L();
    if (!l.replace) {
      const c = remain(m);
      c[res.item.id] = Math.max(0, (c[res.item.id] || 0) - 1);
    }
    if (l.ticketMode === 'ticket') student.tickets = Math.max(0, (student.tickets || 0) - 1);
    const base = l.baseOne ? 1 : 0;
    const bonus = res.item.type === 'prize' ? 0 : (Number(res.item.points) || 0);
    let total = base + bonus;
    let next = student.score + total;
    if (D().settings.noNegative && next < 0) next = 0;
    total = next - student.score;
    student.score = next;
    const hit = isHit(res.item);
    student.pityMiss = hit ? 0 : (student.pityMiss || 0) + 1;
    const roundDone = !l.replace && totalOf(remainAll()[m].counts) === 0;
    const mname = MACHINES.find((x) => x.id === m).name;
    D().history.push({
      t: new Date().toISOString(), type: 'lottery', classId: W.cls().id, studentId: student.id, name: student.name,
      delta: total, score: next, item: label(res.item), hit, pity: res.pity, pool: pool.name, machine: mname
    });
    W.save();
    const top = pool.items.slice().sort((a, b) => (b.type === 'prize') - (a.type === 'prize') || b.points - a.points)[0];
    return { ...res, base, bonus, total, hit, roundDone, top: top && top.id === res.item.id };
  }

  // 畫面上要顯示的球（太多時按比例縮減，但每一種至少留 1 顆）
  function displayBalls(m, maxBalls) {
    const ws = weights(m).filter((x) => x.w > 0);
    const total = ws.reduce((a, b) => a + b.w, 0);
    const scale = total > maxBalls ? maxBalls / total : 1;
    const out = [];
    ws.forEach((x) => {
      const n = Math.max(1, Math.round(x.w * scale));
      for (let i = 0; i < n; i++) out.push(x.item);
    });
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  // 抽到的獎項：有底色的牌子，放在機器前面也看得清楚
  function badge(item) {
    return `<div class="prize-badge" style="--c:${item.color};--t:${inkFor(item.color)}">${esc(label(item))}</div>`;
  }

  // ---------- 彩帶 ----------
  function confetti(amount = 140) {
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const colors = ['#f5b82e', '#2e9d5b', '#3b82f6', '#e85d75', '#8b5cf6', '#14b8a6'];
    const ps = Array.from({ length: amount }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      g.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach((p) => {
        p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.globalAlpha = Math.max(0, 1 - t / 2200);
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      });
      if (t < 2200) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  // 畫布：用 300×300 的座標畫，自動配合實際大小
  function makeCanvas(box) {
    const cv = box.querySelector('canvas');
    const dpr = window.devicePixelRatio || 1;
    const side = box.clientWidth;
    cv.width = side * dpr; cv.height = side * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr * side / 300, 0, 0, dpr * side / 300, 0, 0);
    return g;
  }

  // ---------- 扭蛋機 ----------
  const GACHA_BACK = `
    <ellipse cx="150" cy="292" rx="96" ry="6" fill="rgba(0,0,0,.12)"/>
    <circle cx="150" cy="128" r="80" fill="#e8f4fd"/>
    <path d="M92 206 L208 206 L226 280 L74 280 Z" fill="#e53935" stroke="#e53935" stroke-width="10" stroke-linejoin="round"/>
    <path d="M98 214 L116 214 L104 272 L86 272 Z" fill="#ef5350" opacity=".7"/>
    <rect x="64" y="278" width="172" height="14" rx="7" fill="#c62828"/>
    <path d="M126 280 L126 262 Q126 246 150 246 Q174 246 174 262 L174 280 Z" fill="#7f1d1d"/>
    <path d="M132 280 L132 264 Q132 252 150 252 Q168 252 168 264 L168 280 Z" fill="#f8b4b4"/>
    <g class="knob" style="transform-origin:150px 228px">
      <circle cx="150" cy="228" r="14" fill="#ffca28" stroke="#f9a825" stroke-width="3"/>
      <rect x="138" y="224.5" width="24" height="7" rx="3.5" fill="#f57f17"/>
    </g>`;
  const GACHA_FRONT = `
    <circle cx="150" cy="128" r="80" fill="none" stroke="#bfe0f7" stroke-width="5"/>
    <path d="M96 92 A66 66 0 0 1 132 64" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".9"/>
    <circle cx="94" cy="110" r="5" fill="#fff" opacity=".9"/>
    <rect x="88" y="198" width="124" height="14" rx="7" fill="#c62828"/>
    <path d="M100 64 Q100 30 150 28 Q200 30 200 64 Z" fill="#e53935"/>
    <path d="M112 52 Q116 38 136 34" stroke="#ff8a80" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="94" y="58" width="112" height="12" rx="6" fill="#c62828"/>
    <circle cx="150" cy="24" r="8" fill="#c62828"/>`;
  const G = { x: 150, y: 128, r: 76 };

  const gacha = {
    mount(box) {
      box.innerHTML = `
        <svg viewBox="0 0 300 300" class="skin-svg layer">${GACHA_BACK}</svg>
        <canvas class="skin-canvas layer"></canvas>
        <svg viewBox="0 0 300 300" class="skin-svg layer">${GACHA_FRONT}</svg>
        <div class="cap-drop hidden"><div class="cap-top"></div><div class="cap-bot"></div></div>
        <div class="reveal hidden"></div>`;
      const g = makeCanvas(box);
      const R = 12;
      const balls = displayBalls('gacha', 18).map((item, i) => ({
        item, x: G.x + (Math.random() - 0.5) * 100, y: G.y + 10 + Math.random() * 50 - (i % 3) * 8,
        vx: 0, vy: 0, a: Math.random() * Math.PI * 2, va: 0
      }));
      const st = { balls, mode: 'idle', intensity: 0, raf: 0, last: performance.now() };
      this.st = st;
      const frame = (now) => {
        const dt = Math.min(2.2, (now - st.last) / 16.67);
        st.last = now;
        const pop = st.mode === 'pop';
        st.balls.forEach((b) => {
          b.vy += 0.42 * dt;
          // 從底部被「彈」起來，像爆米花一樣跳上跳下
          if (pop && b.y > G.y + 8 && Math.random() < 0.14 * st.intensity * dt) {
            b.vy = -(6 + Math.random() * 8) * Math.min(1.35, 0.6 + st.intensity);
            b.vx += (Math.random() - 0.5) * 8;
            b.va = (Math.random() - 0.5) * 0.5;
          }
          b.vx *= Math.pow(0.992, dt); b.va *= Math.pow(0.97, dt);
          b.x += b.vx * dt; b.y += b.vy * dt; b.a += (b.va + b.vx * 0.02) * dt;
          const dx = b.x - G.x, dy = b.y - G.y, dist = Math.hypot(dx, dy), lim = G.r - R;
          if (dist > lim) {
            const nx = dx / dist, ny = dy / dist;
            b.x = G.x + nx * lim; b.y = G.y + ny * lim;
            const dot = b.vx * nx + b.vy * ny;
            if (dot > 0) { b.vx -= 1.55 * dot * nx; b.vy -= 1.55 * dot * ny; b.vx *= 0.9; }
          }
        });
        for (let k = 0; k < 2; k++) {
          for (let i = 0; i < st.balls.length; i++) for (let j = i + 1; j < st.balls.length; j++) {
            const a = st.balls[i], b = st.balls[j];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d > 0 && d < R * 2) {
              const nx = dx / d, ny = dy / d, o = (R * 2 - d) / 2;
              a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
              const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv < 0) { const im = -rv * 0.8; a.vx -= im * nx * 0.5; a.vy -= im * ny * 0.5; b.vx += im * nx * 0.5; b.vy += im * ny * 0.5; }
            }
          }
        }
        g.clearRect(0, 0, 300, 300);
        g.save();
        g.beginPath(); g.arc(G.x, G.y, G.r, 0, Math.PI * 2); g.clip();
        st.balls.forEach((b) => {
          g.save(); g.translate(b.x, b.y); g.rotate(b.a);
          g.fillStyle = b.item.color; g.beginPath(); g.arc(0, 0, R, Math.PI, 0); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI); g.fill();
          g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.stroke();
          g.restore();
          g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(b.x - 4, b.y - 5, 2.6, 0, Math.PI * 2); g.fill();
        });
        g.restore();
        st.raf = requestAnimationFrame(frame);
      };
      st.raf = requestAnimationFrame(frame);
    },
    unmount() { if (this.st) cancelAnimationFrame(this.st.raf); this.st = null; },
    async play(box, item, ctx) {
      const st = this.st;
      if (!st) return;
      ctx.dark(true);
      const stop = Sound.suspense(3600);
      st.mode = 'pop';
      const t0 = performance.now();
      while (performance.now() - t0 < 2700 && this.st === st) {
        st.intensity = 0.45 + (performance.now() - t0) / 2700 * 1.0;
        await sleep(60);
      }
      if (this.st !== st) { stop(); return; }
      st.mode = 'settle';
      const knob = box.querySelector('.knob');
      knob.style.transition = 'transform .9s ease-in-out';
      knob.style.transform = 'rotate(360deg)';
      Sound.clunk(); setTimeout(() => Sound.clunk(), 300); setTimeout(() => Sound.clunk(), 600);
      await sleep(950);
      stop();
      // 從機器裡拿掉一顆同顏色的（看起來真的少了一顆）
      const idx = st.balls.findIndex((b) => b.item.id === item.id);
      if (idx >= 0 && !L().replace) st.balls.splice(idx, 1);
      const cap = box.querySelector('.cap-drop');
      cap.style.setProperty('--c', item.color);
      cap.className = 'cap-drop at-door';
      await sleep(40);
      cap.className = 'cap-drop rolled';
      Sound.clunk();
      await sleep(700);
      ctx.dark(false);
      cap.className = 'cap-drop center';
      await sleep(650);
      cap.className = 'cap-drop center open';
      const rv = box.querySelector('.reveal');
      rv.innerHTML = badge(item);
      rv.className = 'reveal show';
      await sleep(450);
    }
  };

  // ---------- 日本抽獎機（福引抽選器）：小朋友抓住把手轉一圈 ----------
  const GC = { x: 158, y: 132 };
  const OCT = (r) => Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + i * Math.PI / 4;
    return `${(GC.x + r * Math.cos(a)).toFixed(1)},${(GC.y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const garapon = {
    mount(box, ctx) {
      const panels = Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI / 8 + i * Math.PI / 4;
        return `<line x1="${GC.x}" y1="${GC.y}" x2="${(GC.x + 84 * Math.cos(a)).toFixed(1)}" y2="${(GC.y + 84 * Math.sin(a)).toFixed(1)}" stroke="#e5bf62" stroke-width="2"/>`;
      }).join('');
      box.innerHTML = `
        <svg viewBox="0 0 300 300" class="skin-svg garapon-svg">
          <ellipse cx="150" cy="290" rx="130" ry="6" fill="rgba(0,0,0,.1)"/>
          <rect x="22" y="268" width="262" height="16" rx="5" fill="#c8a165"/>
          <rect x="22" y="268" width="262" height="5" rx="2.5" fill="#dbb983"/>
          <path d="M${GC.x} ${GC.y} L110 270 M${GC.x} ${GC.y} L206 270" stroke="#9fb0ba" stroke-width="12" stroke-linecap="round"/>
          <path d="M126 222 L190 222" stroke="#9fb0ba" stroke-width="8" stroke-linecap="round"/>
          <path d="M30 236 L104 236 L104 262 L30 262 Z" fill="#dfe6ea" stroke="#b0bec5" stroke-width="3" stroke-linejoin="round"/>
          <path d="M30 236 L30 262 M104 236 L104 262" stroke="#b0bec5" stroke-width="5" stroke-linecap="round"/>
          <path d="M78 202 L94 214 L70 238" stroke="#b0bec5" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <g class="drum">
            <polygon points="${OCT(96)}" fill="#f7d98a" stroke="#d9a93f" stroke-width="8" stroke-linejoin="round"/>
            ${panels}
            <polygon points="${OCT(60)}" fill="#fbe5a6" stroke="#e5bf62" stroke-width="3"/>
            <polygon points="${OCT(96)}" fill="none" stroke="#c58f2a" stroke-width="2"/>
          </g>
          <path class="prog" d="" fill="none" stroke="#2e9d5b" stroke-width="6" stroke-linecap="round" opacity=".85"/>
          <circle cx="${GC.x}" cy="${GC.y}" r="14" fill="#8d6e63" stroke="#5d4037" stroke-width="3"/>
          <g class="crank">
            <line class="arm" x1="${GC.x}" y1="${GC.y}" x2="${GC.x}" y2="${GC.y - 72}" stroke="#78909c" stroke-width="11" stroke-linecap="round"/>
            <circle class="grip" cx="${GC.x}" cy="${GC.y - 72}" r="17" fill="#8d3b1f" stroke="#5d2512" stroke-width="3"/>
            <circle class="grip-hi" cx="${GC.x - 5}" cy="${GC.y - 77}" r="4.5" fill="#c06a46"/>
          </g>
          <circle class="out-ball" cx="88" cy="206" r="10" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width="1.5" opacity="0"/>
          <g class="bell" opacity="0" style="transform-origin:58px 66px">
            <rect x="54" y="20" width="8" height="30" rx="4" fill="#8d4a2b" transform="rotate(-20 58 50)"/>
            <path d="M38 92 Q38 56 58 50 Q78 56 78 92 Z" fill="#f5b82e" stroke="#d48b07" stroke-width="3" stroke-linejoin="round"/>
            <rect x="34" y="88" width="48" height="8" rx="4" fill="#d48b07"/>
            <circle cx="58" cy="100" r="5" fill="#d48b07"/>
          </g>
        </svg>
        <div class="g-hint">抓住紅色把手，轉一圈！</div>
        <div class="reveal hidden"></div>`;
      const st = { theta: 0, acc: 0, drag: false, last: 0, lastRattle: 0, done: false, box, ctx };
      this.st = st;
      this.draw(st);
      const svgEl = box.querySelector('svg');
      const ang = (e) => {
        const r = svgEl.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * 300, y = (e.clientY - r.top) / r.height * 300;
        return Math.atan2(y - GC.y, x - GC.x);
      };
      box.onpointerdown = (e) => {
        if (st.done || ctx.busy()) return;
        if (!ctx.canStart()) return;
        st.drag = true; st.last = ang(e);
        box.setPointerCapture(e.pointerId);
        box.querySelector('.g-hint').classList.add('gone');
        Sound.unlock();
      };
      box.onpointermove = (e) => {
        if (!st.drag) return;
        const a = ang(e);
        let d = a - st.last;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        st.last = a;
        this.turn(st, d);
        if (st.acc >= Math.PI * 2) { st.drag = false; this.manualDone(st); }
      };
      box.onpointerup = box.onpointercancel = () => { st.drag = false; };
    },
    // 把手轉了 d 弧度：桶子跟著轉、發出球碰撞的聲音
    turn(st, d) {
      st.theta += d;
      st.acc = Math.min(Math.PI * 2, st.acc + Math.abs(d));
      if (Math.abs(st.theta - st.lastRattle) > 0.32) { st.lastRattle = st.theta; Sound.rattle(); }
      this.draw(st);
    },
    draw(st) {
      const box = st.box;
      const deg = st.theta * 180 / Math.PI;
      box.querySelector('.drum').setAttribute('transform', `rotate(${deg.toFixed(1)} ${GC.x} ${GC.y})`);
      const gx = GC.x + 72 * Math.sin(st.theta), gy = GC.y - 72 * Math.cos(st.theta);
      const arm = box.querySelector('.arm');
      arm.setAttribute('x2', gx.toFixed(1)); arm.setAttribute('y2', gy.toFixed(1));
      box.querySelector('.grip').setAttribute('cx', gx.toFixed(1)); box.querySelector('.grip').setAttribute('cy', gy.toFixed(1));
      box.querySelector('.grip-hi').setAttribute('cx', (gx - 5).toFixed(1)); box.querySelector('.grip-hi').setAttribute('cy', (gy - 5).toFixed(1));
      // 外圈綠色進度：轉滿一圈就出球
      const p = st.acc / (Math.PI * 2);
      const prog = box.querySelector('.prog');
      if (p <= 0.001 || st.done) { prog.setAttribute('d', ''); return; }
      const r = 108, a1 = -Math.PI / 2 + Math.min(p, 0.9999) * Math.PI * 2;
      const x0 = GC.x, y0 = GC.y - r, x1 = GC.x + r * Math.cos(a1), y1 = GC.y + r * Math.sin(a1);
      prog.setAttribute('d', `M${x0} ${y0} A${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`);
    },
    unmount() {
      if (this.st) { const b = this.st.box; b.onpointerdown = b.onpointermove = b.onpointerup = b.onpointercancel = null; }
      this.st = null;
    },
    async manualDone(st) {
      st.done = true;
      this.draw(st);
      const res = st.ctx.manualDraw();
      if (!res) { st.done = false; st.acc = 0; this.draw(st); return; }
      await this.release(st, res.item);
      st.ctx.finish(res);
    },
    // 老師按按鈕：自動轉一圈
    async play(box, item) {
      const st = this.st;
      if (!st) return;
      box.querySelector('.g-hint').classList.add('gone');
      st.done = false;
      const steps = 46;
      for (let i = 0; i < steps && this.st === st; i++) { this.turn(st, Math.PI * 2 / steps); await sleep(30); }
      if (this.st !== st) return;
      st.done = true; this.draw(st);
      await this.release(st, item);
    },
    // 球從出口掉出來，滾到盤子裡
    async release(st, item) {
      const box = st.box;
      const ball = box.querySelector('.out-ball');
      ball.setAttribute('fill', item.color);
      ball.setAttribute('opacity', '1');
      Sound.clunk();
      const path = [[88, 206], [92, 214], [80, 226], [68, 238], [52, 248], [40, 250], [48, 250]];
      for (let i = 0; i < path.length; i++) {
        ball.setAttribute('cx', path[i][0]); ball.setAttribute('cy', path[i][1]);
        if (i === 4) Sound.clunk();
        await sleep(i < 4 ? 70 : 110);
      }
      if (isHit(item)) {
        const bell = box.querySelector('.bell');
        bell.setAttribute('opacity', '1');
        bell.classList.add('ring');
        Sound.bell();
      }
      await sleep(250);
      const rv = box.querySelector('.reveal');
      rv.innerHTML = `<div class="big-ball" style="--c:${item.color}"></div>${badge(item)}`;
      rv.className = 'reveal show ball';
      await sleep(500);
    }
  };

  // ---------- 轉盤 ----------
  const wheel = {
    rot: 0,
    mount(box) {
      const ws = weights('wheel').filter((x) => x.w > 0);
      const total = ws.reduce((a, b) => a + b.w, 0);
      let ang = 0;
      const R = 130, cx = 150, cy = 155;
      const pt = (a, r) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
      this.segs = [];
      const parts = ws.map((x) => {
        const span = x.w / total * 360;
        const a0 = ang, a1 = ang + span; ang = a1;
        this.segs.push({ id: x.item.id, a0, a1 });
        const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
        const large = span > 180 ? 1 : 0;
        const path = span >= 359.99
          ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${x.item.color}" stroke="#fff" stroke-width="3"/>`
          : `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" fill="${x.item.color}" stroke="#fff" stroke-width="3"/>`;
        const mid = (a0 + a1) / 2, [lx, ly] = pt(mid, R * 0.66);
        const fs = span < 25 ? 12 : span < 45 ? 16 : 22;
        const ink = inkFor(x.item.color);
        const txt = `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${mid.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="bold" fill="${ink}">${esc(shortLabel(x.item))}</text>`;
        return path + txt;
      }).join('');
      box.innerHTML = `
        <svg viewBox="0 0 300 300" class="skin-svg">
          <circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="#3b2f22"/>
          <g class="wheel" style="transform-origin:${cx}px ${cy}px;transform:rotate(${this.rot % 360}deg)">${parts}</g>
          <circle cx="${cx}" cy="${cy}" r="20" fill="#fff4dc" stroke="#3b2f22" stroke-width="5"/>
          <path d="M${cx - 15} 8 L${cx + 15} 8 L${cx} 38 Z" fill="#e2574c" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
        </svg>`;
      this.rot = this.rot % 360;
    },
    async play(box, item) {
      const seg = this.segs.find((s) => s.id === item.id) || this.segs[0];
      const a = seg.a0 + (seg.a1 - seg.a0) * (0.18 + Math.random() * 0.64);
      const cur = ((this.rot % 360) + 360) % 360;
      const need = ((360 - a - cur) % 360 + 360) % 360;
      this.rot += 360 * 5 + need;
      const g = box.querySelector('.wheel');
      g.style.transition = 'transform 4.2s cubic-bezier(.15,.7,.2,1)';
      g.style.transform = `rotate(${this.rot}deg)`;
      let t = 0, gap = 40;
      while (t < 3900) { setTimeout(() => Sound.tick(), t); t += gap; gap *= 1.11; }
      await sleep(4400);
    }
  };

  // ---------- 骰子 ----------
  const dice = {
    mount(box) {
      const first = displayBalls('dice', 6)[0];
      box.innerHTML = `<div class="die3"><div class="die-face" style="--c:${first ? first.color : '#999'}"><span>${first ? esc(shortLabel(first)) : '?'}</span></div><div class="die-shadow"></div></div>`;
    },
    async play(box, item) {
      const face = box.querySelector('.die-face');
      const pool = displayBalls('dice', 30);
      face.classList.add('rolling');
      for (let i = 0; i < 16; i++) {
        const it = pool[i % pool.length];
        face.style.setProperty('--c', it.color);
        face.querySelector('span').textContent = shortLabel(it);
        face.style.transform = `translate(${(Math.random() - 0.5) * 40}px, ${-Math.random() * 40}px) rotate(${Math.round((Math.random() - 0.5) * 140)}deg)`;
        if (i % 3 === 0) Sound.tick();
        await sleep(55 + i * 6);
      }
      face.classList.remove('rolling');
      face.style.setProperty('--c', item.color);
      face.querySelector('span').textContent = shortLabel(item);
      face.style.transform = 'translate(0,0) rotate(0deg)';
      face.classList.add('land');
      Sound.clunk();
      await sleep(500);
    }
  };

  const SKIN_IMPL = { gacha, garapon, wheel, dice };

  // ---------- 獎項編輯器（抽獎畫面和設定都用這個） ----------
  function renderEditor(box, m, onChange) {
    box.__peM = m; box.__peOnChange = onChange;
    const pool = poolFor(m);
    const total = pool.items.reduce((a, it) => a + (Number(it.count) || 0), 0);
    const hit = pool.items.filter(isHit).reduce((a, it) => a + (Number(it.count) || 0), 0);
    const shared = usersOf(pool.id).filter((n) => n !== MACHINES.find((x) => x.id === m).name);
    const l = L();
    let remainHtml = '';
    if (!l.replace) {
      const ws = weights(m);
      const left = ws.reduce((a, b) => a + b.w, 0);
      remainHtml = `<div class="pe-remain"><span class="muted">這一輪還剩 ${left} 顆：</span>${ws.map((x) => `<span class="rb" style="--c:${x.item.color};--t:${inkFor(x.item.color)}">${esc(label(x.item))}×${x.w}</span>`).join('')}
        <button data-pe="refill">重新裝滿</button></div>`;
    }
    box.innerHTML = `
      <div class="pool-bar">
        <select data-pe="pool" title="這台機器用哪一組獎池">${D().pools.map((p) => `<option value="${p.id}"${p.id === pool.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <button data-pe="new">新增</button><button data-pe="copy">複製</button><button data-pe="del" class="warn">刪除</button>
      </div>
      <label class="field">獎池名稱<input data-pe="pname" type="text" maxlength="12" value="${esc(pool.name)}"></label>
      ${shared.length ? `<p class="muted warn-note">這組獎池也給「${shared.join('、')}」用，改了會一起變。想分開，請按「複製」。</p>` : ''}
      <div class="item-head"><span>顏色</span><span>種類</span><span>內容</span><span>顆數</span><span>機率</span><span></span></div>
      ${pool.items.map((it) => `
        <div class="item-row" data-iid="${it.id}">
          <button class="color-dot" data-ed="color" style="background:${it.color}" title="點一下換顏色"></button>
          <select data-ed="type"><option value="points"${it.type !== 'prize' ? ' selected' : ''}>加分</option><option value="prize"${it.type === 'prize' ? ' selected' : ''}>獎品</option></select>
          ${it.type === 'prize'
            ? `<input data-ed="name" type="text" value="${esc(it.name || '')}" maxlength="8" placeholder="獎品名稱">`
            : `<input data-ed="points" type="number" step="1" min="0" max="99" value="${it.points}" title="加幾分（0＝沒加碼）">`}
          <input data-ed="count" type="number" step="1" min="0" max="99" value="${it.count}" title="放幾顆">
          <span class="pct">${total ? Math.round(it.count / total * 100) : 0}%</span>
          <button data-ed="del" class="del" title="刪除">✕</button>
        </div>`).join('') || '<div class="edit-empty">還沒有獎項，按下面新增。</div>'}
      <div class="btn-row"><button data-pe="add">＋ 新增一種獎項</button></div>
      <p class="muted pe-sum">${total ? `共 ${total} 顆・有加碼的機率 <b>${Math.round(hit / total * 100)}%</b>${hit ? `，平均 <b>${(total / hit).toFixed(1).replace('.0', '')}</b> 次加碼一次` : ''}` : '獎池是空的'}</p>
      ${remainHtml}`;
    if (box.__peBound) return;
    box.__peBound = true;
    const redo = () => { renderEditor(box, box.__peM, box.__peOnChange); if (box.__peOnChange) box.__peOnChange(); };
    box.addEventListener('change', (e) => {
      const mm = box.__peM;
      const p = poolFor(mm);
      const pe = e.target.dataset.pe;
      if (pe === 'pool') { W.snapshot('換獎池'); L().machinePool[mm] = e.target.value; W.save(); redo(); return; }
      if (pe === 'pname') {
        const n = e.target.value.trim();
        if (n) { W.snapshot('獎池改名'); p.name = n; W.save(); }
        redo(); return;
      }
      const row = e.target.closest('.item-row');
      if (!row) return;
      const it = p.items.find((x) => x.id === row.dataset.iid);
      if (!it) return;
      W.snapshot('修改獎項');
      const ed = e.target.dataset.ed;
      if (ed === 'type') { it.type = e.target.value; if (it.type === 'prize' && !it.name) it.name = '獎品'; }
      if (ed === 'points') it.points = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)));
      if (ed === 'name') it.name = e.target.value.trim() || '獎品';
      if (ed === 'count') it.count = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)));
      resetPool(p.id);
      W.save(); redo();
    });
    box.addEventListener('click', async (e) => {
      const mm = box.__peM;
      const p = poolFor(mm);
      const b = e.target.closest('[data-pe],[data-ed]');
      if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
      const pe = b.dataset.pe, ed = b.dataset.ed;
      if (pe === 'new') {
        W.snapshot('新增獎池');
        const np = { id: uid(), name: `獎池 ${D().pools.length + 1}`, items: [
          { id: uid(), type: 'points', points: 0, count: 3, color: BALL_COLORS[0] },
          { id: uid(), type: 'points', points: 1, count: 3, color: BALL_COLORS[1] }] };
        D().pools.push(np); L().machinePool[mm] = np.id; W.save(); redo();
        const inp = box.querySelector('[data-pe=pname]'); inp.focus(); inp.select();
      } else if (pe === 'copy') {
        W.snapshot('複製獎池');
        const np = { id: uid(), name: p.name + ' 複本', items: p.items.map((it) => ({ ...it, id: uid() })) };
        D().pools.push(np); L().machinePool[mm] = np.id; W.save(); redo();
      } else if (pe === 'del') {
        if (D().pools.length === 1) { W.toast('至少要保留一組獎池', false); return; }
        if (!(await W.confirm(`確定要刪除獎池「${p.name}」嗎？`, '刪除'))) return;
        W.snapshot('刪除獎池');
        D().pools = D().pools.filter((x) => x.id !== p.id);
        MACHINES.forEach((x) => { if (L().machinePool[x.id] === p.id) L().machinePool[x.id] = D().pools[0].id; });
        W.save(); redo();
      } else if (pe === 'add') {
        W.snapshot('新增獎項');
        p.items.push({ id: uid(), type: 'points', points: 1, count: 1, color: BALL_COLORS[p.items.length % BALL_COLORS.length] });
        resetPool(p.id); W.save(); redo();
      } else if (pe === 'refill') {
        W.snapshot('重新裝滿'); refill(mm); W.save(); redo(); W.toast('已重新裝滿', true);
      } else if (ed) {
        const it = p.items.find((x) => x.id === b.closest('.item-row').dataset.iid);
        if (!it) return;
        if (ed === 'color') {
          W.snapshot('換顏色');
          it.color = BALL_COLORS[(BALL_COLORS.indexOf(it.color) + 1) % BALL_COLORS.length];
          W.save(); redo();
        } else if (ed === 'del') {
          W.snapshot('刪除獎項');
          p.items = p.items.filter((x) => x !== it);
          resetPool(p.id); W.save(); redo();
        }
      }
    });
  }

  // ---------- 抽獎畫面 ----------
  let cur = null; // { student, machine, busy, root }

  function open(student) {
    close();
    const root = document.createElement('div');
    root.id = 'lotto';
    root.className = 'lotto-overlay';
    root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(student, 40)}<div><b>${esc(student.name)}</b><div class="lotto-sub" id="lottoSub"></div></div></div>
        <div class="skin-tabs">${MACHINES.map((s) => `<button data-skin="${s.id}">${s.name}</button>`).join('')}<button id="lottoEdit" class="edit-btn" title="編輯這台機器的獎項和顆數">✏️ 獎項</button></div>
        <button class="icon-btn lotto-x" id="lottoClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="lotto-stage" id="lottoStage"><div class="spot"></div><div class="machine" id="lottoMachine"></div></div>
      <div class="lotto-info" id="lottoInfo"></div>
      <div class="lotto-actions"><button class="go" id="lottoGo">抽！</button></div>
      <div class="lotto-result hidden" id="lottoResult"></div>
      <div class="lotto-editor hidden" id="lottoEditor">
        <div class="le-head"><b id="leTitle"></b><button id="leDone" class="primary">完成</button></div>
        <div class="le-body" id="leBody"></div>
      </div>`;
    document.body.appendChild(root);
    let mm = L().skin;
    if (!SKIN_IMPL[mm]) mm = 'gacha';
    cur = { student, machine: mm, busy: false, root };
    root.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => {
      if (cur.busy) return;
      L().skin = b.dataset.skin; W.save();
      cur.machine = b.dataset.skin;
      closeEditor(); mountSkin();
    });
    root.querySelector('#lottoClose').onclick = close;
    root.querySelector('#lottoGo').onclick = go;
    root.querySelector('#lottoEdit').onclick = openEditor;
    root.querySelector('#leDone').onclick = () => { closeEditor(); mountSkin(); };
    Sound.unlock();
    requestAnimationFrame(() => mountSkin());
    window.addEventListener('resize', onResize);
  }

  function openEditor() {
    if (!cur || cur.busy) return;
    const ed = cur.root.querySelector('#lottoEditor');
    cur.root.querySelector('#leTitle').textContent = `編輯「${MACHINES.find((x) => x.id === cur.machine).name}」的獎項`;
    renderEditor(cur.root.querySelector('#leBody'), cur.machine, () => renderInfo());
    ed.classList.remove('hidden');
  }
  function closeEditor() {
    if (!cur) return;
    cur.root.querySelector('#lottoEditor').classList.add('hidden');
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (cur && !cur.busy) mountSkin(); }, 150);
  }

  // 給機器用的工具（變暗、小朋友自己轉完時抽獎）
  function ctxFor() {
    return {
      dark: (on) => { if (cur) cur.root.classList.toggle('dark', on); },
      busy: () => !cur || cur.busy,
      canStart: () => {
        if (!cur) return false;
        const ok = canDraw(cur.student) && weights(cur.machine).some((x) => x.w > 0);
        if (!ok) W.toast(canDraw(cur.student) ? '獎池是空的，請按「✏️ 獎項」放入獎項' : `還沒有抽獎券。每得到 ${L().ticketEvery} 分可以拿到 1 張`, false);
        return ok;
      },
      manualDraw: () => {
        if (!cur || cur.busy) return null;
        const res = drawAndApply(cur.student, cur.machine);
        if (!res) return null;
        cur.busy = true;
        cur.root.classList.add('busy');
        cur.root.querySelector('#lottoResult').classList.add('hidden');
        return res;
      },
      finish: (res) => after(res)
    };
  }

  function mountSkin() {
    if (!cur) return;
    const stage = cur.root.querySelector('#lottoStage');
    const m = cur.root.querySelector('#lottoMachine');
    const side = Math.max(140, Math.floor(Math.min(stage.clientWidth, stage.clientHeight)));
    m.style.width = side + 'px'; m.style.height = side + 'px';
    Object.values(SKIN_IMPL).forEach((s) => s.unmount && s.unmount());
    m.className = 'machine m-' + cur.machine;
    SKIN_IMPL[cur.machine].mount(m, ctxFor());
    cur.root.querySelectorAll('[data-skin]').forEach((b) => b.classList.toggle('sel', b.dataset.skin === cur.machine));
    renderInfo();
  }

  function renderInfo() {
    if (!cur) return;
    const s = cur.student, l = L();
    const pool = poolFor(cur.machine);
    const ws = weights(cur.machine);
    const total = ws.reduce((a, b) => a + b.w, 0);
    let info;
    if (!pool.items.length || total === 0) {
      info = '獎池是空的，請按右上角「✏️ 獎項」放入獎項';
    } else if (l.replace) {
      const hit = ws.filter((x) => isHit(x.item)).reduce((a, b) => a + b.w, 0);
      info = `獎池「${esc(pool.name)}」・有加碼的機率 ${Math.round(hit / total * 100)}%`;
    } else {
      const top = pool.items.slice().sort((a, b) => (b.type === 'prize') - (a.type === 'prize') || b.points - a.points)[0];
      const left = ws.find((x) => x.item.id === top.id).w;
      info = `獎池「${esc(pool.name)}」・這一輪還剩 ${total} 顆・最大獎「${esc(label(top))}」${left ? '還在 ✔' : '已經被抽走'}`;
    }
    if (l.pityOn) {
      const need = Math.max(1, Number(l.pityN) || 4) - (s.pityMiss || 0);
      info += need <= 0 ? '・<b>這次保底必中！</b>' : `・保底：再 ${need} 次沒中就必中`;
    }
    cur.root.querySelector('#lottoInfo').innerHTML = info;
    cur.root.querySelector('#lottoSub').textContent = l.ticketMode === 'ticket' ? `🎟 抽獎券 ${s.tickets || 0} 張・⭐ ${s.score}` : `⭐ ${s.score}`;
    const goBtn = cur.root.querySelector('#lottoGo');
    const ok = canDraw(s) && total > 0;
    goBtn.classList.toggle('off', !ok);
    goBtn.textContent = ok ? MACHINES.find((x) => x.id === cur.machine).go : (total === 0 ? '獎池是空的' : '沒有抽獎券了');
  }

  async function go() {
    if (!cur || cur.busy) return;
    const s = cur.student;
    if (!canDraw(s)) { W.toast(`還沒有抽獎券。每得到 ${L().ticketEvery} 分可以拿到 1 張`, false); return; }
    closeEditor();
    const res = drawAndApply(s, cur.machine);
    if (!res) { W.toast('獎池是空的，請按「✏️ 獎項」放入獎項', false); return; }
    cur.busy = true;
    const root = cur.root;
    root.classList.add('busy');
    root.querySelector('#lottoResult').classList.add('hidden');
    try { await SKIN_IMPL[cur.machine].play(root.querySelector('#lottoMachine'), res.item, ctxFor()); } catch (e) { /* 動畫出錯也不影響結果 */ }
    if (!cur || cur.root !== root) { W.renderAll(); return; }
    after(res);
  }

  function after(res) {
    if (!cur) return;
    cur.root.classList.remove('busy', 'dark');
    W.renderAll();
    showResult(res);
  }

  function showResult(res) {
    const box = cur.root.querySelector('#lottoResult');
    const lines = [];
    let big;
    if (res.item.type === 'prize') big = `🎁 ${esc(res.item.name || '獎品')}`;
    else if (res.bonus > 0) big = `加碼 +${res.bonus}！`;
    else big = '這次沒有加碼';
    if (res.base) lines.push(`好行為基本分 +${res.base}`);
    if (res.bonus) lines.push(`抽獎加碼 +${res.bonus}`);
    lines.push(`共 ${res.total >= 0 ? '+' : ''}${res.total} 分・現在 ⭐ ${cur.student.score}`);
    if (res.pity) lines.push('（保底觸發）');
    if (res.roundDone) lines.push('這一輪抽完了，下次會重新裝滿');
    const again = canDraw(cur.student);
    box.innerHTML = `
      <div class="res-big ${res.hit ? 'hit' : 'miss'}" style="--c:${res.item.color}">${big}</div>
      <div class="res-lines">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="btn-row center">
        <button id="resAgain" class="${again ? 'primary' : 'hidden'}">再抽一次</button>
        <button id="resOk">好！</button>
      </div>`;
    box.querySelector('#resOk').onclick = close;
    box.querySelector('#resAgain').onclick = () => { box.classList.add('hidden'); mountSkin(); if (cur.machine !== 'garapon') go(); };
    if (res.hit) { Sound.win(); confetti(res.bonus >= 3 || res.item.type === 'prize' || res.top ? 180 : 90); } else Sound.zero();
    renderInfo();
    // 先讓學生看清楚抽到什麼，再跳出結果卡
    const root = cur.root;
    cur.busy = true;
    setTimeout(() => {
      if (!cur || cur.root !== root) return;
      box.classList.remove('hidden');
      cur.busy = false;
    }, 900);
  }

  function close() {
    if (!cur) return;
    Object.values(SKIN_IMPL).forEach((s) => s.unmount && s.unmount());
    cur.root.remove();
    cur = null;
    window.removeEventListener('resize', onResize);
    W.renderAll();
  }

  function onKey(e) {
    if (!cur) return false;
    if (!cur.root.querySelector('#lottoEditor').classList.contains('hidden')) {
      if (e.key === 'Escape') { closeEditor(); mountSkin(); }
      return true;
    }
    if (e.key === 'Escape') { if (!cur.busy) close(); return true; }
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest && e.target.closest('input, textarea, select')) return true;
      e.preventDefault();
      if (cur.busy) return true;
      const res = cur.root.querySelector('#lottoResult');
      if (!res.classList.contains('hidden')) { res.classList.add('hidden'); mountSkin(); }
      else go();
      return true;
    }
    return true;
  }

  return {
    open, close, onKey, confetti, label, isHit, poolFor, refill, weights, renderEditor, inkFor,
    isOpen: () => !!cur, MACHINES, BALL_COLORS
  };
})();
