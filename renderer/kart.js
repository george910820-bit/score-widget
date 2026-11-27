// 🏎️ 虎尾大賽車：2～4 人在大屏上一起比賽（每人 2 張入場券，前三名分獎池）
(() => {
  'use strict';
  const K = Arcade.kit;
  const LAPS = 3;
  const SC = 1.6;               // 車子放大倍數
  const KEYS = [
    { l: 'a', r: 'd', g: 'w', label: 'A・D・W' },
    { l: 'ArrowLeft', r: 'ArrowRight', g: 'ArrowUp', label: '←・→・↑' },
    { l: 'j', r: 'l', g: 'i', label: 'J・L・I' },
    { l: '4', r: '6', g: '8', label: '4・6・8' }
  ];
  const SPLIT = { 2: [0.6, 0.4], 3: [0.5, 0.3, 0.2], 4: [0.5, 0.3, 0.2] };
  const MEDAL = ['🥇', '🥈', '🥉', '4'];
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const esc = K.esc, sleep = K.sleep;
  const assistOn = () => K.A().kartAssist !== false;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  // 車手：學生收藏冊裡的第一隻娃娃，沒有就隨便一隻
  function driverOf(s, i) {
    const own = Object.keys(s.plush || {}).filter((k) => !k.startsWith('gold:'));
    const types = window.ClawModel ? ClawModel.PLUSH_TYPES : ['bear'];
    return own.length ? own[0] : types[(i * 3 + 1) % types.length];
  }
  function prizesFor(n) {
    const pot = n * 2 * K.price(), sp = SPLIT[n] || SPLIT[4];
    const pr = sp.map((f) => Math.floor(pot * f));
    pr[0] += pot - pr.reduce((a, b) => a + b, 0);
    return { pot, pr };
  }

  function kart(student, back) {
    const sh = K.shell({ student, icon: '🏎️', title: '虎尾大賽車', bg: '#1a1440', back });
    sh.root.classList.add('kt', 'c3-full');
    sh.info(''); sh.actions('');
    if (!window.THREE || !window.RaceModel || !K.webglOK()) {
      sh.stage.innerHTML = '<div class="kt-msg">這台電腦不支援 3D 畫面，沒辦法玩賽車 😢</div>';
      return;
    }
    let players = (student.zoneTickets || 0) >= 2 ? [student] : [];
    let R = null; // 3D 的東西（比賽時才建立）
    let music = null, raf = 0;
    const keyState = {};
    sh.cleanup.push(() => { cancelAnimationFrame(raf); if (music) music.stop(); if (R) { try { R.renderer.dispose(); R.renderer.forceContextLoss(); } catch (e) { /* ignore */ } } window.removeEventListener('keyup', onKeyUp); });

    // ================= 報名 =================
    function lobby() {
      sh.setBusy(false);
      const all = W.cls().students;
      const n = players.length, { pot, pr } = prizesFor(Math.max(2, n));
      const C = RaceModel.CAR_COLORS;
      sh.stage.innerHTML = `<div class="kt-lobby">
        <h1>🏎️ 虎尾大賽車</h1>
        <div class="kt-sub">每人付 🎟 2 張入場券・2～4 人一起比賽・跑 ${LAPS} 圈・前三名分獎池</div>
        <div class="kt-slots">${[0, 1, 2, 3].map((i) => {
          const s = players[i], c = hex(C[i].body);
          return s
            ? `<div class="kt-slot" style="--c:${c}" data-rm="${s.id}" title="點一下取消報名"><span class="car">${i + 1}號 ${C[i].name}</span>${Avatar.html(s, 110)}<span class="nm">${esc(s.name)}</span><span class="paid">🎟 ×2・按鍵 ${KEYS[i].label}</span></div>`
            : `<div class="kt-slot empty" style="--c:${c}"><span class="plus">＋</span><span class="nm">${i + 1} 號車</span><span>點下面的名字加入</span></div>`;
        }).join('')}</div>
        <div class="kt-pick">${all.map((s) => {
          const ok = (s.zoneTickets || 0) >= 2, inn = players.includes(s);
          return `<button class="kt-pk${ok ? '' : ' no'}${inn ? ' in' : ''}" data-add="${s.id}"${ok && !inn ? '' : ' disabled'}>${Avatar.html(s, 40)}${esc(s.name)} <small>🎟${s.zoneTickets || 0}</small></button>`;
        }).join('')}</div>
        <div class="kt-pot"><span>🏆 獎池</span><span class="chip"><b>${n >= 2 ? pot : '—'}</b> 點</span><span>${n >= 2 ? `＝ ${n} 人 × 2 張 × ${K.price()} 點` : '至少要 2 個人'}</span>${n >= 2 ? `<span class="chip">${pr.map((p, i) => `${MEDAL[i]} ${p}`).join('　')}</span>` : ''}</div>
        <button class="kt-start${n >= 2 ? '' : ' off'}" id="ktStart">開始比賽！</button>
        <div class="kt-note">入場券不到 2 張的同學不能報名（先回遊樂場用點數換）</div>
      </div>`;
      sh.stage.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
        if (players.length >= 4) { W.toast('最多 4 個人', false); return; }
        const s = all.find((x) => x.id === b.dataset.add);
        if (s && !players.includes(s) && (s.zoneTickets || 0) >= 2) { players.push(s); Sound.tick(); lobby(); }
      });
      sh.stage.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { players = players.filter((s) => s.id !== b.dataset.rm); Sound.tick(); lobby(); });
      sh.stage.querySelector('#ktStart').onclick = start;
    }

    function start() {
      if (players.length < 2) { W.toast('至少要 2 個人才能比賽', false); return; }
      if (players.some((s) => (s.zoneTickets || 0) < 2)) { W.toast('有人入場券不夠', false); lobby(); return; }
      W.snapshot('虎尾大賽車');
      players.forEach((s) => {
        s.zoneTickets -= 2;
        if (s !== student) Research.pick(s, '虎尾大賽車');
        Research.decide(s, '虎尾大賽車', '參加比賽', { cost: 2 * K.price(), note: `${players.length} 人一起比` });
      });
      W.save();
      race();
    }

    // ================= 比賽 =================
    function race() {
      const THREE = window.THREE;
      sh.setBusy(true);
      const n = players.length, C = RaceModel.CAR_COLORS;
      sh.stage.innerHTML = `<div class="kt-wrap"><canvas class="kt-cv"></canvas>
        <div class="kt-hud">
          <div class="kt-lap" id="ktLap">🏁 第 <b>1</b> / ${LAPS} 圈 <span class="tm">00:00.0</span></div>
          <div class="kt-rank" id="ktRank"></div>
          <div class="kt-right"><div class="kt-potbox">🏆 獎池<b>${prizesFor(n).pot} 點</b><small>${prizesFor(n).pr.map((p, i) => `${MEDAL[i]}${p}`).join('　')}</small></div><canvas id="ktMini" width="260" height="170"></canvas><button class="kt-stop" id="ktStop" title="老師：提早結束這場比賽">⏹ 結束比賽</button></div>
          <div class="kt-big" id="ktBig"></div>
        </div>
        <div class="kt-pads" style="grid-template-columns:repeat(${n},1fr)">${players.map((s, i) => `
          <div class="kt-pad" style="--c:${hex(C[i].body)}" data-p="${i}">
            <div class="who">${Avatar.html(s, 40)}<span>${esc(s.name)}</span><span class="pl" id="ktPl${i}">－</span></div>
            <button class="kb" data-p="${i}" data-b="l">◀</button><button class="kb" data-p="${i}" data-b="r">▶</button><button class="kb gas" data-p="${i}" data-b="g">🚀<span>油門</span></button>
            <div class="keys">鍵盤 ${KEYS[i].label}</div>
            <div class="done" id="ktDone${i}"></div>
          </div>`).join('')}</div></div>`;
      const wrap = sh.stage.querySelector('.kt-wrap'), cv = wrap.querySelector('.kt-cv');
      const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd3ff); scene.fog = new THREE.Fog(0x8fd3ff, 32, 70);
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
      const world = RaceModel.buildWorld(scene);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
      R = { renderer, scene, camera, world };
      const N = world.N, TW = world.TW, LEN = world.curve.getLength();
      const VMAX = LEN / 26;
      // 加速帶的位置
      const pads = world.boosts.map((b) => { const p = world.pts[b.k], t = world.tang(b.k); return { x: p.x - t.z * b.off, z: p.z + t.x * b.off }; });
      // 車
      const cars = players.map((s, i) => {
        const mesh = RaceModel.kart(i, driverOf(s, i)); mesh.scale.setScalar(SC); scene.add(mesh);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 12), new THREE.MeshBasicMaterial({ color: 0xff9100, transparent: true, opacity: 0.9 }));
        flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.12, -0.52); flame.visible = false; mesh.add(flame);
        const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
        const k0 = N - 12 - row * 16, p = world.pts[k0], t = world.tang(k0);
        const off = side * 0.55;
        return { s, i, mesh, flame, x: p.x - t.z * off, z: p.z + t.x * off, h: Math.atan2(t.x, t.z), v: 0, k: k0, lap: -1, fin: 0, time: 0, boost: 0, inp: { l: false, r: false, g: false }, steer: 0, place: i + 1 };
      });
      cars.forEach((c) => { c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.h; });
      // 小地圖
      const mini = wrap.querySelector('#ktMini'), mg = mini.getContext('2d');
      const xs = world.pts.map((p) => p.x), zs = world.pts.map((p) => p.z);
      const mx0 = Math.min(...xs), mx1 = Math.max(...xs), mz0 = Math.min(...zs), mz1 = Math.max(...zs);
      const ms = Math.min(230 / (mx1 - mx0), 140 / (mz1 - mz0));
      const MX = (x) => 130 + (x - (mx0 + mx1) / 2) * ms, MZ = (z) => 85 + (z - (mz0 + mz1) / 2) * ms;
      function drawMini() {
        mg.clearRect(0, 0, 260, 170);
        mg.lineJoin = 'round'; mg.beginPath(); world.pts.forEach((p, k) => (k ? mg.lineTo(MX(p.x), MZ(p.z)) : mg.moveTo(MX(p.x), MZ(p.z)))); mg.closePath();
        mg.lineWidth = 14; mg.strokeStyle = '#5b5e66'; mg.stroke(); mg.lineWidth = 2; mg.strokeStyle = '#fff'; mg.stroke();
        const s0 = world.pts[0]; mg.fillStyle = '#fff'; mg.fillRect(MX(s0.x) - 2, MZ(s0.z) - 8, 4, 16);
        cars.slice().sort((a, b) => b.place - a.place).forEach((c) => { mg.fillStyle = hex(C[c.i].body); mg.strokeStyle = '#fff'; mg.lineWidth = 3; mg.beginPath(); mg.arc(MX(c.x), MZ(c.z), 7, 0, Math.PI * 2); mg.fill(); mg.stroke(); });
      }
      // 控制：觸控（多點）＋鍵盤
      wrap.querySelectorAll('.kb').forEach((b) => {
        const c = cars[Number(b.dataset.p)], key = b.dataset.b;
        const on = (e) => { e.preventDefault(); c.inp[key] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } };
        const off = () => { c.inp[key] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, off));
        b.addEventListener('contextmenu', (e) => e.preventDefault());
      });
      const setKey = (e, down) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        let hit = false;
        cars.forEach((c, i) => ['l', 'r', 'g'].forEach((b) => { if (KEYS[i][b] === k) { c.inp[b] = down; hit = true; const el = wrap.querySelector(`.kb[data-p="${i}"][data-b="${b}"]`); if (el) el.classList.toggle('on', down); } }));
        return hit;
      };
      sh.onKey = (e) => setKey(e, true) || e.key === ' ';
      onKeyUp = (e) => setKey(e, false);
      window.addEventListener('keyup', onKeyUp);
      // 老師提早結束
      wrap.querySelector('#ktStop').onclick = async () => { if (await W.confirm('要提早結束這場比賽嗎？\n會照現在的名次發獎。', '結束')) finishAll(); };

      const big = wrap.querySelector('#ktBig');
      const bigMsg = (html, ms = 1200, cls = '') => { big.innerHTML = html; big.className = 'kt-big on ' + cls; clearTimeout(bigMsg.t); if (ms) bigMsg.t = setTimeout(() => { big.className = 'kt-big'; }, ms); };
      // 鏡頭
      const camS = { x: 0, z: 0, h: 14 };
      const fitCam = (dt, instant) => {
        const act = cars.filter((c) => !c.fin || cars.every((d) => d.fin));
        const list = act.length ? act : cars;
        const cx = list.reduce((a, c) => a + c.x, 0) / list.length, cz = list.reduce((a, c) => a + c.z, 0) / list.length;
        const spread = Math.max(...list.map((c) => Math.hypot(c.x - cx, c.z - cz)));
        const h = Math.max(9, Math.min(26, 8 + spread * 1.25));
        const k = instant ? 1 : Math.min(1, dt * 2.2);
        camS.x += (cx - camS.x) * k; camS.z += (cz - camS.z) * k; camS.h += (h - camS.h) * k;
        camera.position.set(camS.x - camS.h * 0.08, camS.h, camS.z + camS.h * 0.66);
        camera.lookAt(camS.x - camS.h * 0.05, 0, camS.z + camS.h * 0.16);
      };
      const resize = () => { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const ro = new ResizeObserver(resize); ro.observe(wrap); sh.cleanup.push(() => ro.disconnect());
      resize(); fitCam(0, true);

      let phase = 'count', t0 = 0, lastT = performance.now(), firstFinT = 0, lastBump = 0, finalLapShown = false;
      const finishOrder = [];
      const nearestK = (c) => {
        let best = c.k, bd = 1e9;
        for (let d = -30; d <= 30; d++) { const kk = (c.k + d + N) % N, p = world.pts[kk], dd = (p.x - c.x) ** 2 + (p.z - c.z) ** 2; if (dd < bd) { bd = dd; best = kk; } }
        return { k: best, d: Math.sqrt(bd) };
      };
      const prog = (c) => c.lap * N + c.k;
      function updateRanks() {
        const order = cars.slice().sort((a, b) => (a.fin && b.fin ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : prog(b) - prog(a)));
        order.forEach((c, r) => { c.place = r + 1; });
        wrap.querySelector('#ktRank').innerHTML = order.map((c) => `<div class="rk" style="--c:${hex(C[c.i].body)}"><span class="n">${c.place}</span>${Avatar.html(c.s, 32)}<span>${esc(c.s.name)}</span>${c.fin ? '<b>🏁</b>' : ''}</div>`).join('');
        cars.forEach((c) => { const el = wrap.querySelector('#ktPl' + c.i); if (el) el.textContent = `第 ${c.place} 名`; });
      }
      function step(dt, now) {
        const raceT = (now - t0) / 1000;
        const alive = cars.filter((c) => !c.fin);
        const rankOf = (c) => alive.slice().sort((a, b) => prog(b) - prog(a)).indexOf(c);
        cars.forEach((c) => {
          const nk = nearestK(c);
          // 過起跑線：圈數 +1（倒著開回去就 -1）
          if (c.k > N * 0.8 && nk.k < N * 0.2) { c.lap++; if (!c.fin && c.lap >= LAPS) onFinish(c, raceT); else if (c.lap >= 1 && !c.fin) { Sound.bell(); if (c.lap === LAPS - 1 && !finalLapShown) { finalLapShown = true; bigMsg('🔥 最後一圈！', 1500, 'warn'); if (music) music.fast(); } } }
          else if (c.k < N * 0.2 && nk.k > N * 0.8) c.lap--;
          c.k = nk.k;
          const t = world.tang(c.k), nx = -t.z, nz = t.x, cp = world.pts[c.k];
          const lat = (c.x - cp.x) * nx + (c.z - cp.z) * nz;
          const off = Math.abs(lat) > TW / 2 + 0.05;
          // 速度
          let vmax = VMAX * (off ? 0.5 : 1);
          if (!c.fin && alive.length >= 2) { const r = rankOf(c); if (r === alive.length - 1) vmax *= 1.06; else if (r === alive.length - 2 && alive.length >= 3) vmax *= 1.03; }
          if (c.boost > 0) { vmax *= 1.45; c.boost -= dt; }
          const gas = c.fin ? false : c.inp.g;
          if (gas) c.v += (c.boost > 0 ? 2 : 1) * VMAX * 0.95 * dt; else c.v -= VMAX * (c.fin ? 0.5 : 0.65) * dt;
          if (c.v > vmax) c.v = Math.max(vmax, c.v - VMAX * 1.6 * dt);
          c.v = Math.max(0, c.v);
          // 轉彎
          const sIn = c.fin ? 0 : (c.inp.l ? 1 : 0) - (c.inp.r ? 1 : 0);
          c.steer += (sIn - c.steer) * Math.min(1, dt * 10);
          const grip = Math.min(1, c.v / (VMAX * 0.25));
          c.h += c.steer * 2.5 * grip * dt;
          if (assistOn() || c.fin) {
            const ak = (c.k + 14) % N, ap = world.pts[ak];
            const want = Math.atan2(ap.x - c.x, ap.z - c.z);
            const pull = (sIn ? 0.7 : 2.4) * (off ? 1.6 : 1) * grip;
            c.h += angDiff(want, c.h) * Math.min(1, pull * dt);
          }
          c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
          // 外圍的牆
          const lat2 = (c.x - cp.x) * nx + (c.z - cp.z) * nz, lim = TW / 2 + 1.0;
          if (Math.abs(lat2) > lim) { const push = Math.abs(lat2) - lim; c.x -= Math.sign(lat2) * nx * push; c.z -= Math.sign(lat2) * nz * push; c.v *= 0.7; if (now - lastBump > 250) { Sound.clunk(); lastBump = now; } }
          // 加速帶
          pads.forEach((p) => { if (c.boost <= 0.2 && Math.hypot(p.x - c.x, p.z - c.z) < 0.6) { c.boost = 1.3; Sound.launch(); } });
        });
        // 車子互撞
        for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
          const A = cars[a], B = cars[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = 0.72;
          if (d > 0 && d < min) { const push = (min - d) / 2, ux = dx / d, uz = dz / d; A.x -= ux * push; A.z -= uz * push; B.x += ux * push; B.z += uz * push; A.v *= 0.96; B.v *= 0.96; if (now - lastBump > 300) { Sound.tap(0.6); lastBump = now; } }
        }
        // 畫面
        cars.forEach((c) => {
          c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.h; c.mesh.rotation.z = -c.steer * 0.06 * Math.min(1, c.v / VMAX);
          const wh = c.mesh.userData.wheels; wh.forEach((w, j) => { w.rotation.x += c.v * dt / 0.09 / SC; if (j < 2) w.rotation.y = c.steer * 0.4; });
          c.flame.visible = c.boost > 0; if (c.boost > 0) c.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
        });
        if (firstFinT && (raceT - firstFinT > 20 || cars.every((c) => c.fin))) finishAll();
        if (raceT > 240) finishAll();
      }
      function onFinish(c, raceT) {
        c.fin = finishOrder.length + 1; c.time = raceT; finishOrder.push(c);
        if (!firstFinT) firstFinT = raceT;
        Sound.ticket();
        const done = wrap.querySelector('#ktDone' + c.i); if (done) { done.innerHTML = `${MEDAL[c.fin - 1] || c.fin}<span>${c.fin === 1 ? '冠軍！' : `第 ${c.fin} 名`}</span>`; done.classList.add('on'); }
        if (c.fin === 1) bigMsg(`🏆 ${esc(c.s.name)} 第一個衝線！`, 1800, 'win');
      }
      let ended = false;
      function finishAll() {
        if (ended) return; ended = true;
        const rest = cars.filter((c) => !c.fin).sort((a, b) => prog(b) - prog(a));
        rest.forEach((c) => { c.fin = finishOrder.length + 1; finishOrder.push(c); });
        if (music) { music.stop(); music = null; }
        setTimeout(() => podium(finishOrder.slice()), 1200);
      }
      // 主迴圈
      const loop = (now) => {
        if (sh.closed || (R && R.podium)) return;
        const dt = Math.min(0.05, (now - lastT) / 1000), realDt = Math.min(0.25, (now - lastT) / 1000); lastT = now;
        if (phase === 'race') {
          // 電腦比較慢時，一個畫面算好幾小步，比賽速度才不會變慢
          for (let left = realDt; left > 1e-4; left -= 0.03) step(Math.min(0.03, left), now);
          const el = wrap.querySelector('#ktLap');
          const lead = cars.slice().sort((a, b) => a.place - b.place)[0];
          const lapN = Math.min(LAPS, Math.max(1, lead.lap + 1));
          const sec = (now - t0) / 1000;
          if (el) el.innerHTML = `🏁 第 <b>${lapN}</b> / ${LAPS} 圈 <span class="tm">${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}</span>`;
          updateRanks();
        }
        fitCam(dt);
        drawMini();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      // 倒數
      (async () => {
        const lights = (k) => `<div class="kt-lights">${[0, 1, 2].map((j) => `<i class="${j < k ? 'on' : ''}"></i>`).join('')}</div>`;
        for (let k = 1; k <= 3; k++) { bigMsg(`<div class="cd">${4 - k}</div>${lights(k)}`, 0); Sound.tick(); await sleep(800); if (sh.closed) return; }
        bigMsg('<div class="cd go">GO！</div>', 900, 'go'); Sound.launch();
        phase = 'race'; t0 = performance.now(); lastT = t0;
        music = Sound.loopMusic();
      })();
    }

    // ================= 頒獎 =================
    function podium(order) {
      const THREE = window.THREE;
      const n = order.length, { pr } = prizesFor(n);
      order.forEach((c, r) => { c.prize = pr[r] || 0; K.record(c.s, '虎尾大賽車', 2, c.prize, { rank: r + 1, players: n }); });
      R.podium = true; cancelAnimationFrame(raf);
      const { renderer, camera } = R;
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a1a5e);
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x554488, 0.8));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 5, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.05, 64), new THREE.MeshStandardMaterial({ color: 0x3d2a80 })); fl.receiveShadow = true; scene.add(fl);
      const spots = [[0, 0.6, 0xffd54f], [-1.15, 0.4, 0xcfd8dc], [1.15, 0.25, 0xffab91]];
      order.slice(0, 3).forEach((c, r) => {
        const [x, h, col] = spots[r];
        const b = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.05, h, 1.0, 4, 0.06), new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.3 })); b.position.set(x, h / 2, 0); b.castShadow = true; b.receiveShadow = true; scene.add(b);
        const car = RaceModel.kart(c.i, driverOf(c.s, c.i)); car.position.set(x, h, 0); car.rotation.y = x > 0 ? -0.35 : x < 0 ? 0.35 : 0; scene.add(car);
      });
      const conf = [];
      for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), new THREE.MeshBasicMaterial({ color: [0xffd54f, 0xff4081, 0x40c4ff, 0x69f0ae][i % 4], side: THREE.DoubleSide })); m.position.set((Math.random() - 0.5) * 6, 0.5 + Math.random() * 3.5, (Math.random() - 0.5) * 3); m.rotation.set(Math.random() * 6, Math.random() * 6, 0); m.userData.v = 0.3 + Math.random() * 0.5; scene.add(m); conf.push(m); }
      camera.position.set(0, 2.0, 3.9); camera.lookAt(0, 0.15, 0);
      const wrap = sh.stage.querySelector('.kt-wrap');
      wrap.querySelector('.kt-hud').innerHTML = `<div class="kt-title">🏆 比賽結束！</div>
        <div class="kt-res">${order.map((c, r) => `<div class="res" style="--c:${hex(RaceModel.CAR_COLORS[c.i].body)}">${MEDAL[r]} ${esc(c.s.name)}<b${c.prize ? '' : ' class="z"'}>+${c.prize} 點</b></div>`).join('')}</div>
        <div class="kt-btns"><button class="kt-again" id="ktAgain">再比一場</button><button id="ktBack">回遊樂場</button></div>`;
      wrap.querySelector('.kt-pads').remove();
      Sound.jackpot();
      sh.setBusy(false);
      let last = performance.now(), alive = true;
      const loop = (now) => {
        if (sh.closed || !alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        conf.forEach((m) => { m.position.y -= m.userData.v * dt; m.rotation.x += dt * 3; if (m.position.y < 0) m.position.y = 4; });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      wrap.querySelector('#ktAgain').onclick = () => { alive = false; cancelAnimationFrame(raf); try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* ignore */ } R = null; FX.clear(sh.root); players = players.filter((s) => (s.zoneTickets || 0) >= 2); lobby(); };
      wrap.querySelector('#ktBack').onclick = () => sh.close();
    }

    let onKeyUp = () => {};
    sh.onSpace = () => {};
    lobby();
  }

  Arcade.register('kart', kart);
})();
