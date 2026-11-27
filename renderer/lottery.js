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
    if (student.isClass) return W.cls().students.length > 0; // 全班加分：老師按的，不用抽獎券
    return L().ticketMode !== 'ticket' || (student.tickets || 0) > 0;
  }

  // 抽一次並馬上記錄（就算動畫還沒播完就關掉，結果也已經存好）
  // 全班加分：抽一次，全班每個人都加一樣的分數
  function drawForClass(student, m) {
    const pool = poolFor(m);
    const res = pick(student, m);
    if (!res) return null;
    const c = W.cls();
    W.snapshot('全班抽獎加分');
    const l = L();
    if (!l.replace) { const rc = remain(m); rc[res.item.id] = Math.max(0, (rc[res.item.id] || 0) - 1); }
    const base = l.baseOne ? 1 : 0;
    const bonus = res.item.type === 'prize' ? 0 : (Number(res.item.points) || 0);
    const total = base + bonus;
    const hit = isHit(res.item);
    student.pityMiss = hit ? 0 : (student.pityMiss || 0) + 1;
    c.classPity = student.pityMiss;
    const mname = MACHINES.find((x) => x.id === m).name;
    const t = new Date().toISOString();
    c.students.forEach((s) => {
      let next = s.score + total;
      if (D().settings.noNegative && next < 0) next = 0;
      const d = next - s.score;
      s.score = next;
      D().history.push({ t, type: 'lottery', classId: c.id, studentId: s.id, name: s.name, delta: d, score: next, item: '全班加分：' + label(res.item), hit, pity: res.pity, pool: pool.name, machine: mname, wholeClass: true });
    });
    student.score = total;
    W.save();
    const roundDone = !l.replace && totalOf(remainAll()[m].counts) === 0;
    const top = pool.items.slice().sort((a, b) => (b.type === 'prize') - (a.type === 'prize') || b.points - a.points)[0];
    return { ...res, base, bonus, total, hit, roundDone, top: top && top.id === res.item.id };
  }

  function drawAndApply(student, m) {
    if (student.isClass) return drawForClass(student, m);
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
      const stop = ctx.wait(2400);
      st.mode = 'pop';
      const t0 = performance.now();
      while (performance.now() - t0 < 1400 && this.st === st) {
        st.intensity = 0.8 + (performance.now() - t0) / 1400 * 0.8;
        await sleep(50);
      }
      if (this.st !== st) { stop(); return; }
      st.mode = 'settle';
      const knob = box.querySelector('.knob');
      knob.style.transition = 'transform .5s ease-in-out';
      knob.style.transform = 'rotate(360deg)';
      Sound.clunk(); setTimeout(() => Sound.clunk(), 250);
      await sleep(500);
      // 從機器裡拿掉一顆同顏色的（看起來真的少了一顆）
      const idx = st.balls.findIndex((b) => b.item.id === item.id);
      if (idx >= 0 && !L().replace) st.balls.splice(idx, 1);
      const cap = box.querySelector('.cap-drop');
      cap.style.setProperty('--c', item.color);
      cap.className = 'cap-drop at-door';
      await sleep(40);
      cap.className = 'cap-drop rolled';
      Sound.clunk();
      await sleep(500);
      stop();
      ctx.dark(false);
      cap.className = 'cap-drop center';
      await sleep(450);
      cap.className = 'cap-drop center open';
      const rv = box.querySelector('.reveal');
      rv.innerHTML = badge(item);
      rv.className = 'reveal show';
      await sleep(250);
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
        <div class="g-hint">抓住紅色把手，轉一圈以上！</div>
        <div class="g-hint2 gone">放開手，球就會掉出來！</div>
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
      };
      // 至少轉滿一圈；手（或滑鼠）放開的那一刻，球才掉出來
      box.onpointerup = box.onpointercancel = () => {
        if (!st.drag) return;
        st.drag = false;
        box.querySelector('.g-hint2').classList.add('gone');
        if (st.acc >= Math.PI * 2 && !st.done) this.manualDone(st);
      };
    },
    // 把手轉了 d 弧度：桶子跟著轉、發出球碰撞的聲音
    turn(st, d) {
      st.theta += d;
      st.acc += Math.abs(d);
      if (st.drag && st.acc >= Math.PI * 2) st.box.querySelector('.g-hint2').classList.remove('gone');
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
      const p = Math.min(1, st.acc / (Math.PI * 2));
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
      const steps = 36;
      for (let i = 0; i < steps && this.st === st; i++) { this.turn(st, Math.PI * 2 / steps); await sleep(22); }
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
        await sleep(i < 4 ? 55 : 80);
      }
      // 球在盤子裡：燈光變暗、聚光、等一下才揭曉
      const ctx = st.ctx;
      ctx.dark(true);
      ball.classList.add('glowing');
      const stop = ctx.wait(1000);
      await sleep(1000);
      stop();
      ball.classList.remove('glowing');
      ctx.dark(false);
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

  // ---------- 轉盤：賭場輪盤，小鋼珠在外圈繞、掉進格子裡跳來跳去，最後停在抽到的那一格 ----------
  const RC = 150;
  const wheel = {
    rot: 0,
    // 依獎項顆數排出格子：至少 24 格，同一種獎項盡量不要排在一起
    pockets() {
      const ws = weights('wheel').filter((x) => x.w > 0);
      const total = ws.reduce((a, b) => a + b.w, 0);
      if (!total) return [];
      const k = total < 24 ? Math.ceil(24 / total) : 1;
      const scale = total * k > 40 ? 40 / (total * k) : 1;
      const bag = [];
      ws.forEach((x) => { const n = Math.max(1, Math.round(x.w * k * scale)); for (let i = 0; i < n; i++) bag.push(x.item); });
      // 輪流從顆數最多的那一種拿，排開相同的
      const groups = ws.map((x) => ({ item: x.item, n: bag.filter((b) => b === x.item).length }));
      const out = [];
      while (groups.some((g) => g.n > 0)) {
        groups.sort((a, b) => b.n - a.n);
        const g = groups.find((gg) => gg.n > 0 && (!out.length || out[out.length - 1] !== gg.item)) || groups[0];
        out.push(g.item); g.n--;
      }
      return out;
    },
    mount(box) {
      const pk = this.pockets();
      this.pk = pk;
      const n = Math.max(1, pk.length), span = 360 / n;
      const pool = poolFor('wheel');
      const top = pool.items.slice().sort((a, b) => (b.type === 'prize') - (a.type === 'prize') || b.points - a.points)[0];
      const pt = (a, r) => [RC + r * Math.sin(a * Math.PI / 180), RC - r * Math.cos(a * Math.PI / 180)];
      const arc = (r0, r1, a0, a1) => {
        const [x0, y0] = pt(a0, r1), [x1, y1] = pt(a1, r1), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0);
        return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r0} ${r0} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
      };
      let num = '', inner = '', frets = '';
      pk.forEach((it, i) => {
        const a0 = i * span, a1 = a0 + span, mid = a0 + span / 2;
        const isTop = top && it.id === top.id;
        const fill = isTop ? '#d4a017' : (Number(it.points) === 0 && it.type !== 'prize' ? '#1f8a3b' : (i % 2 ? '#1c1c1c' : '#c0262d'));
        const ink = isTop ? '#3b2400' : '#ffffff';
        num += `<path d="${arc(88, 110, a0, a1)}" fill="${fill}" stroke="#d9b45a" stroke-width=".8"/>`;
        const [lx, ly] = pt(mid, 99);
        const lab = shortLabel(it);
        const fs = Math.min(13, Math.max(7, span * 0.85)) * (lab.length > 2 ? 0.8 : 1);
        num += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${mid.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})" text-anchor="middle" dominant-baseline="central" font-size="${fs.toFixed(1)}" font-weight="bold" fill="${ink}">${esc(lab)}</text>`;
        inner += `<path class="pocket" data-p="${i}" d="${arc(70, 88, a0, a1)}" fill="${i % 2 ? '#2f9e44' : '#237a35'}"/>`;
        const [fx0, fy0] = pt(a0, 70), [fx1, fy1] = pt(a0, 110);
        frets += `<line x1="${fx0.toFixed(2)}" y1="${fy0.toFixed(2)}" x2="${fx1.toFixed(2)}" y2="${fy1.toFixed(2)}" stroke="#e9d9a8" stroke-width="1.1"/>`;
      });
      const diamonds = Array.from({ length: 8 }, (_, i) => {
        const a = i * 45 + 22.5, [x, y] = pt(a, 120);
        return `<path d="M${x} ${y - 4} L${x + 3} ${y} L${x} ${y + 4} L${x - 3} ${y}Z" fill="#f3d27a" transform="rotate(${a} ${x} ${y})"/>`;
      }).join('');
      const arms = [0, 90, 180, 270].map((a) => {
        const [x1, y1] = pt(a, 34);
        return `<line x1="${RC}" y1="${RC}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="url(#rGold)" stroke-width="4.5" stroke-linecap="round"/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="5" fill="url(#rGold)"/>`;
      }).join('');
      box.innerHTML = `
        <svg viewBox="0 0 300 300" class="skin-svg roulette">
          <defs>
            <radialGradient id="rWood" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#d48a3c"/><stop offset=".7" stop-color="#8a4a17"/><stop offset="1" stop-color="#5a2c0c"/></radialGradient>
            <radialGradient id="rTrack" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#a8642a"/><stop offset="1" stop-color="#4a230a"/></radialGradient>
            <radialGradient id="rCone" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#e0a35c"/><stop offset="1" stop-color="#7a4316"/></radialGradient>
            <linearGradient id="rGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#e2b33c"/><stop offset="1" stop-color="#9c7414"/></linearGradient>
            <radialGradient id="rBall" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#dfe4ea"/><stop offset="1" stop-color="#8a96a3"/></radialGradient>
          </defs>
          <circle cx="${RC}" cy="${RC}" r="148" fill="#0e4d24"/>
          <circle cx="${RC}" cy="${RC}" r="143" fill="url(#rWood)"/>
          <circle cx="${RC}" cy="${RC}" r="143" fill="none" stroke="#e2b33c" stroke-width="2"/>
          <circle cx="${RC}" cy="${RC}" r="131" fill="url(#rTrack)"/>
          <circle cx="${RC}" cy="${RC}" r="131" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>
          ${diamonds}
          <g class="rotor">
            <circle cx="${RC}" cy="${RC}" r="112" fill="#d9b45a"/>
            ${num}${inner}${frets}
            <circle cx="${RC}" cy="${RC}" r="110" fill="none" stroke="#e9d9a8" stroke-width="1.2"/>
            <circle cx="${RC}" cy="${RC}" r="70" fill="url(#rCone)"/>
            ${[0, 45, 90, 135].map((a) => { const [x0, y0] = pt(a, 68), [x1, y1] = pt(a + 180, 68); return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="rgba(80,40,10,.35)" stroke-width="1"/>`; }).join('')}
            <circle cx="${RC}" cy="${RC}" r="70" fill="none" stroke="#e2b33c" stroke-width="2"/>
            ${arms}
            <circle cx="${RC}" cy="${RC}" r="11" fill="url(#rGold)" stroke="#9c7414" stroke-width="1"/>
            <circle cx="${RC}" cy="${RC - 3}" r="4" fill="#fff6d0" opacity=".8"/>
          </g>
          <circle class="rball-shadow" cx="${RC}" cy="${RC - 122}" r="6" fill="rgba(0,0,0,.35)"/>
          <circle class="rball" cx="${RC}" cy="${RC - 124}" r="5.6" fill="url(#rBall)" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
        </svg>`;
      this.rot = ((this.rot % 360) + 360) % 360;
      this.box = box;
      this.setRotor(this.rot);
      this.setBall(-30, 124, 0);
    },
    setRotor(deg) {
      const g = this.box && this.box.querySelector('.rotor');
      if (g) g.setAttribute('transform', `rotate(${deg.toFixed(2)} ${RC} ${RC})`);
    },
    setBall(worldDeg, r, lift) {
      const b = this.box && this.box.querySelector('.rball');
      if (!b) return;
      const a = worldDeg * Math.PI / 180;
      const x = RC + r * Math.sin(a), y = RC - r * Math.cos(a);
      b.setAttribute('cx', x.toFixed(2)); b.setAttribute('cy', (y - lift).toFixed(2));
      b.setAttribute('r', (5.6 + lift * 0.12).toFixed(2));
      const sh = this.box.querySelector('.rball-shadow');
      sh.setAttribute('cx', (x + 1.5 + lift * 0.3).toFixed(2)); sh.setAttribute('cy', (y + 2).toFixed(2));
      sh.setAttribute('opacity', Math.max(0.15, 1 - lift / 14).toFixed(2));
    },
    async play(box, item, ctx) {
      const pk = this.pk || [];
      const idx = pk.map((p, i) => (p.id === item.id ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      ctx.dark(true);
      const T = 3300, TDROP = 1450;
      const stop = ctx.wait(T);
      const n = pk.length, span = 360 / n;
      const target = idx[Math.floor(Math.random() * idx.length)];
      const pocketMid = target * span + span / 2;
      // 輪盤順時針慢下來；小鋼珠逆時針快速繞圈
      const r0 = this.rot, wR = 150;
      const rotorAt = (t) => r0 + wR * 1.6 * (1 - Math.exp(-t / 1600));
      const spins = 1080 + Math.random() * 120;
      const ease = (p) => 1 - Math.pow(1 - p, 2.4);
      const t0 = performance.now();
      let lastCell = null, lastTick = 0, lastHop = 0;
      await new Promise((resolve) => {
        const frame = (now) => {
          if (!this.box || !this.box.isConnected) { resolve(); return; }
          const t = Math.min(T, now - t0), p = t / T;
          const rot = rotorAt(t);
          this.setRotor(rot);
          // 珠子相對於輪盤的角度：從遠處快速逆轉，最後收到目標格子
          let rel = pocketMid + spins * (1 - ease(p));
          let r, lift = 0;
          if (t < TDROP) {
            r = 124;
            if (now - lastTick > 60 + p * 140) { Sound.tick(); lastTick = now; }
          } else {
            const q = (t - TDROP) / (T - TDROP);
            // 掉進格子區：半徑往內縮、上下彈跳，左右在格子之間晃來晃去（心懸一線）
            r = 124 - (124 - 79) * Math.min(1, q * 3.2);
            const hopP = Math.abs(Math.sin(q * Math.PI * 5.5)) * Math.pow(1 - q, 1.6);
            lift = hopP * 9;
            rel += Math.sin(q * Math.PI * 4.2) * span * 1.15 * Math.pow(1 - q, 1.8);
            if (hopP < 0.06 && now - lastHop > 120 && q < 0.95) { Sound.rattle(); lastHop = now; }
          }
          const cell = Math.floor((((rel % 360) + 360) % 360) / span);
          if (t >= TDROP && cell !== lastCell && lastCell !== null) Sound.tick();
          lastCell = cell;
          this.setBall(rot + rel, r, lift);
          if (t < T) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      this.rot = rotorAt(T);
      Sound.clunk();
      const cellEl = box.querySelector(`.pocket[data-p="${target}"]`);
      if (cellEl) cellEl.classList.add('win-pocket');
      stop();
      ctx.dark(false);
      await sleep(250);
    }
  };

  // 立體骰子：六個面放獎項，丟出去會跳、會滾、會彈，最後停在抽到的那一面
  // 每一面轉到正前方要的角度（rotateX, rotateY）
  const FACE_ROT = [[0, 0], [0, 180], [0, -90], [0, 90], [-90, 0], [90, 0]];
  const FACE_CLS = ['f-front', 'f-back', 'f-right', 'f-left', 'f-top', 'f-bottom'];
  const dice = {
    faces: [],
    mount(box) {
      let items = displayBalls('dice', 6);
      if (!items.length) items = [{ color: '#999', points: 0, type: 'points' }];
      this.faces = Array.from({ length: 6 }, (_, i) => items[i % items.length]);
      box.innerHTML = `
        <div class="d3-floor"></div>
        <div class="d3-shadow"></div>
        <div class="d3-pos"><div class="d3-tilt"><div class="d3-cube">
          ${this.faces.map((it, i) => `<div class="d3-face ${FACE_CLS[i]}" style="--c:${it.color};--t:${inkFor(it.color)}"><span>${esc(shortLabel(it))}</span></div>`).join('')}
        </div></div></div>`;
      this.rx = -8; this.ry = 12; this.rz = 0;
      this.apply(box, 0, 0);
    },
    apply(box, x, y) {
      box.querySelector('.d3-pos').style.transform = `translate(${x.toFixed(2)}cqw, ${y.toFixed(2)}cqw)`;
      box.querySelector('.d3-cube').style.transform = `rotateX(${this.rx.toFixed(1)}deg) rotateY(${this.ry.toFixed(1)}deg) rotateZ(${this.rz.toFixed(1)}deg)`;
      const h = Math.max(0, -y);
      const sh = box.querySelector('.d3-shadow');
      sh.style.transform = `translateX(calc(-50% + ${x.toFixed(2)}cqw)) scale(${Math.max(0.35, 1 - h / 70).toFixed(2)})`;
      sh.style.opacity = Math.max(0.15, 0.55 - h / 120).toFixed(2);
    },
    async play(box, item, ctx) {
      ctx.dark(true);
      const stop = ctx.wait(2800);
      // 確定抽到的獎項在某一面上
      let idx = this.faces.map((f, i) => (f.id === item.id ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) {
        const k = Math.floor(Math.random() * 6);
        this.faces[k] = item;
        const el = box.querySelectorAll('.d3-face')[k];
        el.style.setProperty('--c', item.color); el.style.setProperty('--t', inkFor(item.color));
        el.querySelector('span').textContent = shortLabel(item);
        idx = [k];
      }
      const target = idx[Math.floor(Math.random() * idx.length)];
      // 物理：從左上方丟出來，落地彈跳、一邊翻滾
      let x = -58, y = -70, vx = 34 + Math.random() * 8, vy = -10;
      let wx = 600 + Math.random() * 300, wy = 480 + Math.random() * 300, wz = 160 + Math.random() * 160;
      const G = 260, FLY = 1900;
      const t0 = performance.now();
      let last = t0, bounces = 0;
      Sound.whoosh();
      await new Promise((resolve) => {
        const step = (now) => {
          if (!box.isConnected) { resolve(); return; }
          const dt = Math.min(0.04, (now - last) / 1000);
          last = now;
          vy += G * dt; x += vx * dt; y += vy * dt;
          if (y > 0) {
            y = 0;
            if (Math.abs(vy) > 12) { Sound.clunk(); bounces++; }
            vy = -Math.abs(vy) * 0.52; vx *= 0.72;
            wx *= 0.62; wy *= 0.62; wz *= 0.5;
          }
          if (x > 30) { x = 30; vx = -Math.abs(vx) * 0.5; }
          this.rx += wx * dt; this.ry += wy * dt; this.rz += wz * dt;
          this.apply(box, x, y);
          if (now - t0 < FLY) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
      // 最後滾到抽到的那一面朝前
      const near = (cur, base) => base + Math.round((cur - base) / 360) * 360;
      const [bx, by] = FACE_ROT[target];
      const tx = near(this.rx, bx), ty = near(this.ry, by), tz = near(this.rz, 0);
      const fx = this.rx, fy = this.ry, fz = this.rz, sx = x, sy = y;
      const t1 = performance.now(), SET = 650;
      await new Promise((resolve) => {
        const step = (now) => {
          if (!box.isConnected) { resolve(); return; }
          const p = Math.min(1, (now - t1) / SET);
          const e = 1 - Math.pow(1 - p, 3);
          this.rx = fx + (tx - fx) * e; this.ry = fy + (ty - fy) * e; this.rz = fz + (tz - fz) * e;
          const hop = Math.sin(p * Math.PI) * -6;
          this.apply(box, sx + (0 - sx) * e, sy + (0 - sy) * e + hop);
          if (p < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
      Sound.clunk();
      stop();
      ctx.dark(false);
      const face = box.querySelectorAll('.d3-face')[target];
      face.classList.add('win-face');
      await sleep(250);
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

  // 全班加分用的「全班」
  function classPseudo() {
    const c = W.cls();
    return { id: '__class', name: '全班', isClass: true, score: 0, tickets: 0, pityMiss: c.classPity || 0, avatar: { type: 'emoji', emoji: '🏫', bg: '#ffe3a3' } };
  }
  function openClass() { if (!W.cls().students.length) { W.toast('還沒有學生', false); return; } open(classPseudo()); }

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
      <div class="lotto-stage" id="lottoStage"><div class="fx-behind"></div><div class="spot"></div><div class="machine" id="lottoMachine"></div></div>
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
      FX.clear(root);
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
      wait: (ms) => {
        if (!cur) return () => {};
        const stop = FX.suspense(cur.root, ms);
        cur.stopWait = stop;
        return stop;
      },
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
        FX.clear(cur.root);
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
    cur.root.querySelector('#lottoSub').textContent = s.isClass ? `全班 ${W.cls().students.length} 人一起抽，抽到幾分每個人都加` : (l.ticketMode === 'ticket' ? `🎟 抽獎券 ${s.tickets || 0} 張・⭐ ${s.score}` : `⭐ ${s.score}`);
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
    FX.clear(root);
    try { await SKIN_IMPL[cur.machine].play(root.querySelector('#lottoMachine'), res.item, ctxFor()); } catch (e) { /* 動畫出錯也不影響結果 */ }
    if (!cur || cur.root !== root) { W.renderAll(); return; }
    after(res);
  }

  function after(res) {
    if (!cur) return;
    if (cur.stopWait) { cur.stopWait(); cur.stopWait = null; }
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
    if (cur.student.isClass) lines.push(`全班 ${W.cls().students.length} 個人，每個人都 ${res.total >= 0 ? '+' : ''}${res.total} 分！`);
    else lines.push(`共 ${res.total >= 0 ? '+' : ''}${res.total} 分・現在 ⭐ ${cur.student.score}`);
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
    box.querySelector('#resAgain').onclick = () => { box.classList.add('hidden'); FX.clear(cur.root); mountSkin(); if (cur.machine !== 'garapon') go(); };
    // 中獎專屬特效：最大獎＝金色背光＋大獎音效；其他中獎＝小獎特效
    const tier = !res.hit ? 'miss' : (res.top ? 'big' : 'small');
    FX.win(cur.root, tier, cur.root.querySelector('.fx-behind'));
    renderInfo();
    // 先讓學生看清楚抽到什麼，再跳出結果卡
    const root = cur.root;
    cur.busy = true;
    setTimeout(() => {
      if (!cur || cur.root !== root) return;
      box.classList.remove('hidden');
      cur.busy = false;
    }, 600);
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
      if (!res.classList.contains('hidden')) { res.classList.add('hidden'); FX.clear(cur.root); mountSkin(); }
      else go();
      return true;
    }
    return true;
  }

  return { openClass,
    open, close, onKey, confetti, label, isHit, poolFor, refill, weights, renderEditor, inkFor,
    isOpen: () => !!cur, MACHINES, BALL_COLORS
  };
})();
