// 抽獎機：獎池、放回／不放回、保底、抽獎券，四種外觀（扭蛋機、彩球機、轉盤、骰子）
window.Lottery = (() => {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SKINS = [
    { id: 'gacha', name: '扭蛋機' },
    { id: 'blower', name: '彩球機' },
    { id: 'wheel', name: '轉盤' },
    { id: 'dice', name: '骰子' }
  ];

  // ---------- 獎池計算 ----------
  const D = () => W.data;
  const L = () => D().settings.lottery;

  function activePool() {
    const d = D();
    return d.pools.find((p) => p.id === d.activePoolId) || d.pools[0];
  }
  function isHit(item) { return item.type === 'prize' || Number(item.points) > 0; }
  function label(item) {
    if (item.type === 'prize') return item.name || '獎品';
    const p = Number(item.points) || 0;
    return p === 0 ? '0' : (p > 0 ? '+' + p : String(p));
  }
  function shortLabel(item) { return [...label(item)].slice(0, 3).join(''); }

  // 不放回模式：這一輪還剩幾顆。換了獎池或抽完就重新裝滿
  function remain(pool) {
    const d = D();
    const r = d.lotteryRemain;
    const valid = r && r.poolId === pool.id && r.counts &&
      pool.items.every((it) => typeof r.counts[it.id] === 'number');
    if (!valid || totalOf(r.counts) === 0) refill(pool);
    return d.lotteryRemain.counts;
  }
  function refill(pool) {
    const counts = {};
    pool.items.forEach((it) => { counts[it.id] = Math.max(0, Math.round(Number(it.count) || 0)); });
    D().lotteryRemain = { poolId: pool.id, counts };
  }
  const totalOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

  // 目前每一種球的「顆數」（放回＝設定的顆數；不放回＝這一輪剩下的）
  function weights(pool) {
    if (L().replace) return pool.items.map((it) => ({ item: it, w: Math.max(0, Math.round(Number(it.count) || 0)) }));
    const c = remain(pool);
    return pool.items.map((it) => ({ item: it, w: c[it.id] || 0 }));
  }

  function pityActive(student) {
    const l = L();
    return l.pityOn && (student.pityMiss || 0) >= Math.max(1, Number(l.pityN) || 4);
  }

  function pick(student) {
    const pool = activePool();
    let ws = weights(pool).filter((x) => x.w > 0);
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
  function drawAndApply(student) {
    const pool = activePool();
    const res = pick(student);
    if (!res) return null;
    W.snapshot(`${student.name} 抽獎`);
    const l = L();
    if (!l.replace) {
      const c = remain(pool);
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
    const roundDone = !l.replace && totalOf(D().lotteryRemain.counts) === 0;
    D().history.push({
      t: new Date().toISOString(), type: 'lottery', classId: W.cls().id, studentId: student.id, name: student.name,
      delta: total, score: next, item: label(res.item), hit, pity: res.pity, pool: pool.name
    });
    W.save();
    return { ...res, base, bonus, total, hit, roundDone };
  }

  // 畫面上要顯示的球（太多時按比例縮減，但每一種至少留 1 顆）
  function displayBalls(maxBalls) {
    const ws = weights(activePool()).filter((x) => x.w > 0);
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

  // ---------- 外觀：扭蛋機 ----------
  const gacha = {
    mount(box) {
      const balls = displayBalls(26);
      const pos = [];
      let tries = 0;
      while (pos.length < balls.length && tries < 3000) {
        tries++;
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 70;
        const x = 150 + Math.cos(a) * rr, y = 112 + Math.sin(a) * rr * 0.95;
        if (y < 60) continue;
        if (pos.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > 24 * 24) || tries > 2500) pos.push({ x, y });
      }
      const caps = pos.map((p, i) => {
        const c = balls[i].color;
        const rot = Math.round(Math.random() * 360);
        return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${rot})"><path d="M-13 0a13 13 0 0 1 26 0z" fill="${c}"/><path d="M-13 0a13 13 0 0 0 26 0z" fill="#fff"/><circle r="13" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></g>`;
      }).join('');
      box.innerHTML = `
        <svg viewBox="0 0 300 300" class="skin-svg">
          <rect x="70" y="190" width="160" height="100" rx="18" fill="#e2574c"/>
          <rect x="70" y="190" width="160" height="14" fill="#c9443a"/>
          <circle cx="150" cy="112" r="96" fill="#eaf6ff" stroke="#9cc8e8" stroke-width="5"/>
          <g class="caps">${caps}</g>
          <path d="M78 78 a96 96 0 0 1 60 -58" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity=".8"/>
          <g class="knob" style="transform-origin:150px 232px">
            <circle cx="150" cy="232" r="22" fill="#fff4dc" stroke="#b8862b" stroke-width="4"/>
            <rect x="124" y="227" width="52" height="10" rx="5" fill="#b8862b"/>
          </g>
          <rect x="128" y="262" width="44" height="20" rx="6" fill="#5a2a22"/>
        </svg>
        <div class="cap-drop hidden"><div class="cap-top"></div><div class="cap-bot"></div><div class="cap-label"></div></div>`;
    },
    async play(box, item) {
      const knob = box.querySelector('.knob');
      const caps = box.querySelector('.caps');
      caps.classList.add('shake');
      knob.style.transition = 'transform 1s ease-in-out';
      knob.style.transform = 'rotate(360deg)';
      Sound.clunk(); setTimeout(() => Sound.clunk(), 450); setTimeout(() => Sound.clunk(), 900);
      await sleep(1150);
      caps.classList.remove('shake');
      const cap = box.querySelector('.cap-drop');
      cap.style.setProperty('--c', item.color);
      cap.querySelector('.cap-label').textContent = label(item);
      cap.classList.remove('hidden');
      cap.className = 'cap-drop at-chute';
      await sleep(30);
      cap.className = 'cap-drop dropped';
      Sound.clunk();
      await sleep(650);
      cap.className = 'cap-drop center';
      await sleep(700);
      cap.className = 'cap-drop center open';
      await sleep(450);
    }
  };

  // ---------- 外觀：彩球機 ----------
  const blower = {
    mount(box) {
      box.innerHTML = '<canvas class="skin-canvas"></canvas><div class="ball-reveal hidden"><span></span></div>';
      const cv = box.querySelector('canvas');
      const dpr = window.devicePixelRatio || 1;
      const side = box.clientWidth;
      cv.width = side * dpr; cv.height = side * dpr;
      const k = side / 300;
      const g = cv.getContext('2d');
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      const C = { x: 140, y: 150, r: 100 };
      const R = 11;
      const balls = displayBalls(36).map((item) => {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * (C.r - R - 4);
        return { item, x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr * 0.5 + 40, vx: 0, vy: 0 };
      });
      const st = { balls, mode: 'idle', chosen: null, path: null, t0: 0, raf: 0 };
      this.st = st;
      const tube = [[C.x, C.y - C.r + 4], [C.x, 22], [272, 22], [272, 268]];
      st.tube = tube;
      const draw = (now) => {
        g.clearRect(0, 0, 300, 300);
        // 底座
        g.fillStyle = '#2f6f9f'; g.beginPath(); g.moveTo(85, 268); g.lineTo(195, 268); g.lineTo(178, 238); g.lineTo(102, 238); g.closePath(); g.fill();
        g.fillStyle = '#245a82'; g.fillRect(70, 266, 140, 14);
        // 出球管
        g.strokeStyle = '#cfe3f2'; g.lineWidth = 28; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); tube.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
        g.strokeStyle = '#eef7ff'; g.lineWidth = 20;
        g.beginPath(); tube.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
        // 球體
        g.fillStyle = 'rgba(214,236,255,.55)'; g.beginPath(); g.arc(C.x, C.y, C.r, 0, Math.PI * 2); g.fill();
        // 物理
        const mixing = st.mode === 'mix';
        st.balls.forEach((b) => {
          if (b === st.chosen && st.mode === 'exit') return;
          b.vy += mixing ? 0.05 : 0.25;
          if (mixing) { b.vx += (Math.random() - 0.5) * 2.2; b.vy += (Math.random() - 0.62) * 2.6; }
          b.vx *= 0.985; b.vy *= 0.985;
          b.x += b.vx; b.y += b.vy;
          const dx = b.x - C.x, dy = b.y - C.y, dist = Math.hypot(dx, dy), lim = C.r - R - 3;
          if (dist > lim) {
            const nx = dx / dist, ny = dy / dist;
            b.x = C.x + nx * lim; b.y = C.y + ny * lim;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 1.7 * dot * nx; b.vy -= 1.7 * dot * ny;
          }
        });
        for (let i = 0; i < st.balls.length; i++) for (let j = i + 1; j < st.balls.length; j++) {
          const a = st.balls[i], b = st.balls[j];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d > 0 && d < R * 2) { const o = (R * 2 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; }
        }
        const ballAt = (b, x, y) => {
          g.fillStyle = b.item.color; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.stroke();
          g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x - 4, y - 4, 3, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fff'; g.font = 'bold 9px "Microsoft JhengHei UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(shortLabel(b.item), x, y + 1);
        };
        st.balls.forEach((b) => { if (!(b === st.chosen && st.mode === 'exit')) ballAt(b, b.x, b.y); });
        // 被選中的球沿著管子出來
        if (st.mode === 'exit' && st.chosen) {
          const p = Math.min(1, (now - st.t0) / 1500);
          const segs = []; let len = 0;
          for (let i = 1; i < tube.length; i++) { const l = Math.hypot(tube[i][0] - tube[i - 1][0], tube[i][1] - tube[i - 1][1]); segs.push(l); len += l; }
          let dd = p * len, x = tube[0][0], y = tube[0][1];
          for (let i = 0; i < segs.length; i++) {
            if (dd <= segs[i]) { const f = dd / segs[i]; x = tube[i][0] + (tube[i + 1][0] - tube[i][0]) * f; y = tube[i][1] + (tube[i + 1][1] - tube[i][1]) * f; break; }
            dd -= segs[i]; x = tube[i + 1][0]; y = tube[i + 1][1];
          }
          ballAt(st.chosen, x, y);
          st.exitDone = p >= 1;
        }
        g.strokeStyle = '#9cc8e8'; g.lineWidth = 4; g.beginPath(); g.arc(C.x, C.y, C.r, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 6; g.beginPath(); g.arc(C.x, C.y, C.r - 14, Math.PI * 1.1, Math.PI * 1.4); g.stroke();
        st.raf = requestAnimationFrame(draw);
      };
      st.raf = requestAnimationFrame(draw);
    },
    unmount() { if (this.st) cancelAnimationFrame(this.st.raf); this.st = null; },
    async play(box, item) {
      const st = this.st;
      st.mode = 'mix';
      for (let i = 0; i < 16; i++) { setTimeout(() => Sound.tick(), i * 140); }
      await sleep(2300);
      let chosen = st.balls.find((b) => b.item.id === item.id);
      if (!chosen) { chosen = st.balls[0]; chosen.item = item; }
      // 其他球停止翻滾、慢慢落下，被選中的球沿著管子出來
      st.chosen = chosen; st.mode = 'exit'; st.t0 = performance.now(); st.exitDone = false;
      while (!st.exitDone && this.st === st) await sleep(50);
      if (this.st !== st) return;
      Sound.clunk();
      const rv = box.querySelector('.ball-reveal');
      rv.style.setProperty('--c', item.color);
      rv.querySelector('span').textContent = label(item);
      rv.classList.remove('hidden');
      await sleep(30);
      rv.classList.add('show');
      await sleep(500);
    }
  };

  // ---------- 外觀：轉盤 ----------
  const wheel = {
    rot: 0,
    mount(box) {
      const ws = weights(activePool()).filter((x) => x.w > 0);
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
        const txt = `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${mid.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="bold" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width="2" paint-order="stroke">${esc(shortLabel(x.item))}</text>`;
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

  // ---------- 外觀：骰子 ----------
  const dice = {
    mount(box) {
      const first = displayBalls(6)[0];
      box.innerHTML = `<div class="die3"><div class="die-face" style="--c:${first ? first.color : '#999'}"><span>${first ? esc(shortLabel(first)) : '?'}</span></div><div class="die-shadow"></div></div>`;
    },
    async play(box, item) {
      const face = box.querySelector('.die-face');
      const pool = displayBalls(30);
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

  const SKIN_IMPL = { gacha, blower, wheel, dice };

  // ---------- 抽獎畫面 ----------
  let cur = null; // { student, skin, busy }

  function open(student) {
    close();
    const root = document.createElement('div');
    root.id = 'lotto';
    root.className = 'lotto-overlay';
    root.innerHTML = `
      <div class="lotto-top">
        <div class="lotto-who">${Avatar.html(student, 40)}<div><b>${esc(student.name)}</b><div class="lotto-sub" id="lottoSub"></div></div></div>
        <div class="skin-tabs">${SKINS.map((s) => `<button data-skin="${s.id}">${s.name}</button>`).join('')}</div>
        <button class="icon-btn lotto-x" id="lottoClose" title="關閉（Esc）">✕</button>
      </div>
      <div class="lotto-stage" id="lottoStage"><div class="machine" id="lottoMachine"></div></div>
      <div class="lotto-info" id="lottoInfo"></div>
      <div class="lotto-actions"><button class="go" id="lottoGo">抽！</button></div>
      <div class="lotto-result hidden" id="lottoResult"></div>`;
    document.body.appendChild(root);
    cur = { student, skin: L().skin || 'gacha', busy: false, root };
    root.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => {
      if (cur.busy) return;
      L().skin = b.dataset.skin; W.save();
      cur.skin = b.dataset.skin; mountSkin();
    });
    root.querySelector('#lottoClose').onclick = close;
    root.querySelector('#lottoGo').onclick = go;
    Sound.unlock();
    requestAnimationFrame(() => mountSkin());
    window.addEventListener('resize', onResize);
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (cur && !cur.busy) mountSkin(); }, 150);
  }

  function mountSkin() {
    if (!cur) return;
    const stage = cur.root.querySelector('#lottoStage');
    const m = cur.root.querySelector('#lottoMachine');
    const side = Math.max(140, Math.floor(Math.min(stage.clientWidth, stage.clientHeight)));
    m.style.width = side + 'px'; m.style.height = side + 'px';
    Object.values(SKIN_IMPL).forEach((s) => s.unmount && s.unmount());
    SKIN_IMPL[cur.skin].mount(m);
    cur.root.querySelectorAll('[data-skin]').forEach((b) => b.classList.toggle('sel', b.dataset.skin === cur.skin));
    renderInfo();
  }

  function renderInfo() {
    const s = cur.student, l = L();
    const pool = activePool();
    const ws = weights(pool);
    const total = ws.reduce((a, b) => a + b.w, 0);
    let info;
    if (!pool.items.length || total === 0) {
      info = '獎池是空的，請到 ⚙ 設定 → 抽獎機 放入球';
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
    const sub = l.ticketMode === 'ticket' ? `🎟 抽獎券 ${s.tickets || 0} 張・⭐ ${s.score}` : `⭐ ${s.score}`;
    cur.root.querySelector('#lottoSub').textContent = sub;
    const goBtn = cur.root.querySelector('#lottoGo');
    const ok = canDraw(s) && total > 0;
    goBtn.classList.toggle('off', !ok);
    goBtn.textContent = ok ? '抽！' : (total === 0 ? '獎池是空的' : '沒有抽獎券了');
  }

  async function go() {
    if (!cur || cur.busy) return;
    const s = cur.student;
    if (!canDraw(s)) {
      W.toast(`還沒有抽獎券。每得到 ${L().ticketEvery} 分可以拿到 1 張`, false);
      return;
    }
    const res = drawAndApply(s);
    if (!res) { W.toast('獎池是空的', false); return; }
    cur.busy = true;
    const root = cur.root;
    root.classList.add('busy');
    root.querySelector('#lottoResult').classList.add('hidden');
    try { await SKIN_IMPL[cur.skin].play(root.querySelector('#lottoMachine'), res.item); } catch (e) { /* 動畫出錯也不影響結果 */ }
    if (!cur || cur.root !== root) { W.renderAll(); return; }
    root.classList.remove('busy');
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
    if (res.roundDone) lines.push('這一輪的球抽完了，下次會重新裝滿');
    const again = canDraw(cur.student);
    box.innerHTML = `
      <div class="res-big ${res.hit ? 'hit' : 'miss'}" style="--c:${res.item.color}">${big}</div>
      <div class="res-lines">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="btn-row center">
        <button id="resAgain" class="${again ? 'primary' : 'hidden'}">再抽一次</button>
        <button id="resOk">好！</button>
      </div>`;
    box.querySelector('#resOk').onclick = close;
    box.querySelector('#resAgain').onclick = () => { box.classList.add('hidden'); mountSkin(); go(); };
    if (res.hit) { Sound.win(); confetti(res.bonus >= 3 || res.item.type === 'prize' ? 180 : 90); } else Sound.zero();
    renderInfo();
    // 先讓學生看清楚抽到什麼，再跳出結果卡
    const root = cur.root;
    cur.busy = true;
    setTimeout(() => {
      if (!cur || cur.root !== root) return;
      box.classList.remove('hidden');
      cur.busy = false;
    }, 800);
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
    if (e.key === 'Escape') { if (!cur.busy) close(); return true; }
    if (e.key === ' ' || e.key === 'Enter') {
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
    open, close, onKey, confetti, label, isHit, activePool, refill, weights,
    isOpen: () => !!cur, SKINS
  };
})();
