// 3D 賽車：賽道與卡丁車模型（three.js 基本形狀組成）
window.RaceModel = (() => {
  'use strict';
  const T = () => window.THREE;
  function canvasTex(w, h, draw, repeat) {
    const THREE = T();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }

  const CAR_COLORS = [
    { name: '紅色閃電', body: 0xe53935, dark: 0x8e1a17, accent: 0xffd54f },
    { name: '藍色旋風', body: 0x1e88e5, dark: 0x0d47a1, accent: 0xffffff },
    { name: '綠色火箭', body: 0x43a047, dark: 0x1b5e20, accent: 0xffeb3b },
    { name: '黃色流星', body: 0xfdd835, dark: 0xc49000, accent: 0x7b1fa2 }
  ];

  // ---------- 卡丁車（含車手：用夾娃娃機的絨毛娃娃） ----------
  function kart(i, driverType) {
    const THREE = T();
    const C = CAR_COLORS[i % CAR_COLORS.length];
    const g = new THREE.Group();
    const mat = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.15, ...o });
    const body = mat(C.body), dark = mat(C.dark), acc = mat(C.accent), black = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.7 }), chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15 });
    const RB = (w, h, d, m, x, y, z, r = 0.03) => { const o = new THREE.Mesh(new THREE.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    // 底盤＋車身（車頭朝 +z）
    RB(0.44, 0.06, 0.66, dark, 0, 0.07, 0, 0.025);
    RB(0.36, 0.11, 0.52, body, 0, 0.14, 0.02, 0.05);
    const nose = RB(0.3, 0.08, 0.2, body, 0, 0.12, 0.33, 0.04); nose.rotation.x = 0.15;
    RB(0.46, 0.04, 0.08, acc, 0, 0.1, 0.42, 0.02);                                   // 前保險桿
    RB(0.1, 0.1, 0.3, body, -0.22, 0.12, -0.02, 0.04); RB(0.1, 0.1, 0.3, body, 0.22, 0.12, -0.02, 0.04); // 側箱
    RB(0.12, 0.012, 0.28, acc, -0.22, 0.175, -0.02, 0.005); RB(0.12, 0.012, 0.28, acc, 0.22, 0.175, -0.02, 0.005); // 側邊條紋
    // 座椅
    RB(0.2, 0.05, 0.16, black, 0, 0.21, -0.1, 0.03);
    RB(0.2, 0.16, 0.05, black, 0, 0.27, -0.19, 0.03);
    // 尾翼
    RB(0.04, 0.12, 0.04, dark, -0.13, 0.26, -0.3, 0.01); RB(0.04, 0.12, 0.04, dark, 0.13, 0.26, -0.3, 0.01);
    RB(0.46, 0.025, 0.12, acc, 0, 0.33, -0.31, 0.012);
    // 排氣管
    [-0.08, 0.08].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.12, 14), chrome); p.rotation.x = Math.PI / 2; p.position.set(x, 0.12, -0.36); g.add(p); });
    // 方向盤
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 24), black); sw.position.set(0, 0.27, 0.06); sw.rotation.x = -0.9; g.add(sw);
    // 輪子
    const wheels = [];
    [[-0.25, 0.22, 0.085], [0.25, 0.22, 0.085], [-0.26, -0.22, 0.1], [0.26, -0.22, 0.1]].forEach(([x, z, r]) => {
      const w = new THREE.Group(); w.position.set(x, r, z); g.add(w);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 24), black); tire.rotation.z = Math.PI / 2; tire.castShadow = true; w.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.104, 16), chrome); rim.rotation.z = Math.PI / 2; w.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.108, 6), mat(C.accent)); hub.rotation.z = Math.PI / 2; w.add(hub);
      wheels.push(w);
    });
    // 車號牌
    const num = canvasTex(128, 128, (c, w) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.font = '900 92px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), 64, 70); });
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ map: num, roughness: 0.5 }));
    plate.position.set(0, 0.176, 0.3); plate.rotation.x = -Math.PI / 2 + 0.15; g.add(plate);
    const plate2 = plate.clone(); plate2.position.set(0, 0.34, -0.37); plate2.rotation.set(0, Math.PI, 0); g.add(plate2);
    // 車手
    if (driverType && window.ClawModel) {
      const d = ClawModel.plush(driverType);
      d.scale.setScalar(0.95); d.position.set(0, 0.16, -0.08); g.add(d);
      // 護目鏡＋頭帶（不遮住臉）
      const hy = 0.16 + 0.165 * 0.95, hz = -0.08;
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.01, 8, 32), body); band.position.set(0, hy + 0.03, hz + 0.004); band.rotation.x = Math.PI / 2 - 0.35; g.add(band);
      const lensM = new THREE.MeshPhysicalMaterial({ color: 0x80d8ff, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85 });
      [-0.024, 0.024].forEach((x) => { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.005, 8, 20), acc); rim.position.set(x, hy + 0.05, hz + 0.05); rim.rotation.x = -0.6; g.add(rim); const l = new THREE.Mesh(new THREE.CircleGeometry(0.016, 20), lensM); l.position.set(x, hy + 0.05, hz + 0.051); l.rotation.x = -0.6; g.add(l); });
      // 圍巾（車身顏色）
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 24), acc); scarf.position.set(0, 0.16 + 0.11 * 0.95, hz); scarf.rotation.x = Math.PI / 2; g.add(scarf);
    }
    g.userData = { wheels, color: C };
    return g;
  }

  // ---------- 賽道 ----------
  // 中心線（xz 平面，順時針），寬度 TW
  const PTS = [[0, -5.2], [5.5, -5.4], [9.2, -4], [10.2, -1], [8.6, 1.6], [5.4, 2.0], [3.6, 3.8], [4.6, 6.0], [2.2, 7.4], [-2.6, 7.2], [-6.2, 6.4], [-9.4, 4.2], [-10.2, 0.6], [-8.8, -3.2], [-5.2, -5.0]];
  const TW = 2.6;
  function buildWorld(scene, opt = {}) {
    const THREE = T();
    const curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const N = 600;
    const pts = curve.getSpacedPoints(N);
    const tang = (k) => curve.getTangentAt(k / N);
    // 草地
    const grassTex = canvasTex(256, 256, (c, w) => { c.fillStyle = '#5cbf4a'; c.fillRect(0, 0, w, w); for (let i = 0; i < 2600; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(40,120,40,.35)' : 'rgba(150,220,110,.35)'; c.fillRect(Math.random() * w, Math.random() * w, 2, 3); } c.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y < w; y += 64) c.fillRect(0, y, w, 32); }, [14, 14]);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    // 柏油賽道：沿中心線做帶狀網格
    const asph = canvasTex(256, 256, (c, w) => { c.fillStyle = '#55585f'; c.fillRect(0, 0, w, w); for (let i = 0; i < 5000; i++) { const v = 70 + Math.random() * 40; c.fillStyle = `rgb(${v},${v},${v + 4})`; c.fillRect(Math.random() * w, Math.random() * w, 1.5, 1.5); } }, [1, 1]);
    asph.wrapS = asph.wrapT = THREE.RepeatWrapping;
    function ribbon(off0, off1, y, mat, colorFn) {
      const pos = [], uv = [], col = [], idx = [];
      for (let k = 0; k <= N; k++) {
        const p = pts[k % N], t = tang(k % N), nx = -t.z, nz = t.x;
        pos.push(p.x + nx * off0, y, p.z + nz * off0, p.x + nx * off1, y, p.z + nz * off1);
        uv.push(0, k / 6, 1, k / 6);
        if (colorFn) { const c = colorFn(k); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
        if (k < N) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (colorFn) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      mat.side = THREE.DoubleSide;
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
    }
    ribbon(-TW / 2 - 0.35, TW / 2 + 0.35, 0.005, new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 1 })); // 外側沙地
    ribbon(-TW / 2, TW / 2, 0.012, new THREE.MeshStandardMaterial({ map: asph, roughness: 0.85 }));
    const red = new THREE.Color(0xe53935), white = new THREE.Color(0xffffff);
    const curbM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    ribbon(-TW / 2 - 0.18, -TW / 2, 0.02, curbM, (k) => (Math.floor(k / 4) % 2 ? red : white));
    ribbon(TW / 2, TW / 2 + 0.18, 0.02, curbM, (k) => (Math.floor(k / 4) % 2 ? red : white));
    // 中間的白色虛線
    const dashM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    for (let k = 0; k < N; k += 10) {
      const p = pts[k], t = tang(k);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.35), dashM); d.rotation.x = -Math.PI / 2; d.rotation.z = Math.atan2(t.x, t.z); d.position.set(p.x, 0.016, p.z); scene.add(d);
    }
    // 起跑線（棋盤格）
    const p0 = pts[0], t0 = tang(0);
    const chk = canvasTex(256, 32, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 16, y * 16, 16, 16); } });
    const start = new THREE.Mesh(new THREE.PlaneGeometry(TW, 0.3), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.6 }));
    start.rotation.x = -Math.PI / 2; start.rotation.z = Math.atan2(t0.x, t0.z) + Math.PI / 2; start.position.set(p0.x, 0.022, p0.z); scene.add(start);
    // 起跑拱門
    const ang0 = Math.atan2(t0.x, t0.z);
    const arch = new THREE.Group(); arch.position.set(p0.x, 0, p0.z); arch.rotation.y = ang0; scene.add(arch);
    const archM = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.4 });
    [-1, 1].forEach((s) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.8, 16), archM); c.position.set(s * (TW / 2 + 0.35), 0.9, 0); c.castShadow = true; arch.add(c); });
    const banner = canvasTex(1024, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff3d7f'); gr.addColorStop(0.5, '#ffb300'); gr.addColorStop(1, '#ff3d7f'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 110px "Microsoft JhengHei","Noto Sans CJK TC",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 14; c.strokeStyle = '#7a0030'; c.strokeText('虎尾大賽車', w / 2, h / 2 + 6); c.fillText('虎尾大賽車', w / 2, h / 2 + 6); });
    const bn = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.9, 0.42, 0.08), [archM, archM, archM, archM, new THREE.MeshStandardMaterial({ map: banner }), new THREE.MeshStandardMaterial({ map: banner })]);
    bn.position.set(0, 1.75, 0); bn.castShadow = true; arch.add(bn);
    // 加速帶
    const boostTex = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#ff9100'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff59d'; for (let i = 0; i < 3; i++) { const y = 30 + i * 80; c.beginPath(); c.moveTo(16, y + 50); c.lineTo(64, y); c.lineTo(112, y + 50); c.lineTo(112, y + 74); c.lineTo(64, y + 24); c.lineTo(16, y + 74); c.fill(); } });
    const boosts = [];
    [[0.17, -0.45], [0.43, 0.4], [0.7, -0.3], [0.86, 0.45]].forEach(([f, off]) => {
      const k = Math.round(f * N), p = pts[k], t = tang(k), nx = -t.z, nz = t.x;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), new THREE.MeshStandardMaterial({ map: boostTex, emissive: 0xff6d00, emissiveIntensity: 0.6, roughness: 0.4 }));
      b.rotation.x = -Math.PI / 2; b.rotation.z = Math.atan2(t.x, t.z) + Math.PI; b.position.set(p.x + nx * off, 0.024, p.z + nz * off); scene.add(b);
      boosts.push({ k, off, mesh: b });
    });
    // 中間的湖＋小島
    const lake = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshStandardMaterial({ color: 0x29b6f6, roughness: 0.15, metalness: 0.1 }));
    lake.rotation.x = -Math.PI / 2; lake.scale.set(1.4, 1, 1); lake.position.set(-3.2, 0.01, 1.2); scene.add(lake);
    const shore = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.35, 48), new THREE.MeshStandardMaterial({ color: 0xf3e0a6, roughness: 1 }));
    shore.rotation.x = -Math.PI / 2; shore.scale.set(1.4, 1, 1); shore.position.set(-3.2, 0.008, 1.2); scene.add(shore);
    // 樹
    const distToTrack = (x, z) => { let d = 1e9; for (let k = 0; k < N; k += 6) { const p = pts[k]; d = Math.min(d, Math.hypot(p.x - x, p.z - z)); } return d; };
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.9 });
    const leafMs = [0x2e7d32, 0x43a047, 0x66bb6a, 0x9ccc65].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true }));
    let seed = 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let n = 0; n < 160; n++) {
      const x = -15 + rnd() * 30, z = -10 + rnd() * 22;
      if (distToTrack(x, z) < TW / 2 + 0.9) continue;
      if (Math.hypot((x + 3.2) / 1.4, z - 1.2) < 2.6) continue;
      if (x > -1.5 && x < 2.6 && z < -6.4 && z > -9.5) continue; // 看台
      const tr = new THREE.Group(); tr.position.set(x, 0, z); scene.add(tr);
      const s = 0.7 + rnd() * 0.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.4 * s, 8), trunkM); trunk.position.y = 0.2 * s; trunk.castShadow = true; tr.add(trunk);
      if (rnd() < 0.5) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.38 * s, 0.9 * s, 8), leafMs[n % 4]); c.position.y = 0.75 * s; c.castShadow = true; tr.add(c); }
      else { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36 * s, 0), leafMs[n % 4]); c.position.y = 0.6 * s; c.castShadow = true; tr.add(c); }
    }
    // 看台（起跑線旁）
    const stand = new THREE.Group(); stand.position.set(0.6, 0, -7.6); scene.add(stand);
    const crowd = canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#3949ab'; c.fillRect(0, 0, w, h); const cs = ['#ffcc80', '#ffab91', '#fff59d', '#80deea', '#f48fb1', '#a5d6a7', '#ce93d8']; for (let x = 6; x < w; x += 13) { c.fillStyle = cs[(x * 7) % cs.length]; c.beginPath(); c.arc(x, 24 + Math.sin(x) * 4, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = cs[(x * 3) % cs.length]; c.fillRect(x - 5, 30 + Math.sin(x) * 4, 10, 18); } });
    for (let r = 0; r < 4; r++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 0.4), [new THREE.MeshStandardMaterial({ color: 0x9fa8da }), new THREE.MeshStandardMaterial({ color: 0x9fa8da }), new THREE.MeshStandardMaterial({ color: 0x7986cb }), new THREE.MeshStandardMaterial({ color: 0x7986cb }), new THREE.MeshStandardMaterial({ map: crowd }), new THREE.MeshStandardMaterial({ color: 0x7986cb })]);
      st.position.set(0, 0.11 + r * 0.22, -r * 0.4); st.castShadow = true; st.receiveShadow = true; stand.add(st);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 1.9), new THREE.MeshStandardMaterial({ color: 0xff3d7f })); roof.position.set(0, 1.55, -0.6); roof.castShadow = true; stand.add(roof);
    [-2.1, 2.1].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.55, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); p.position.set(x, 0.78, 0.25); stand.add(p); });
    // 彩旗
    const flagCols = [0xe53935, 0xffeb3b, 0x1e88e5, 0x43a047, 0xff9800, 0x8e24aa];
    for (let k = 0; k < N; k += 25) {
      const p = pts[k], t = tang(k), nx = -t.z, nz = t.x, s = (k / 25) % 2 ? 1 : -1;
      const x = p.x + nx * s * (TW / 2 + 0.75), z = p.z + nz * s * (TW / 2 + 0.75);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); pole.position.set(x, 0.4, z); scene.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshStandardMaterial({ color: flagCols[(k / 25) % flagCols.length], side: THREE.DoubleSide })); fl.position.set(x + 0.14, 0.7, z); scene.add(fl);
    }
    // 輪胎牆（外側彎道）
    const tireM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const tireW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    [0.25, 0.32, 0.58, 0.95].forEach((f) => {
      for (let j = -3; j <= 3; j++) {
        const k = (Math.round(f * N) + j * 5 + N) % N, p = pts[k], t = tang(k), nx = -t.z, nz = t.x;
        const side = f === 0.58 ? -1 : 1;
        for (let h = 0; h < 2; h++) { const tt = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 16), h ? tireW : tireM); tt.rotation.x = Math.PI / 2; tt.position.set(p.x + nx * side * (TW / 2 + 0.55), 0.05 + h * 0.1, p.z + nz * side * (TW / 2 + 0.55)); tt.castShadow = true; scene.add(tt); }
      }
    });
    // 燈光
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8f4a, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0); sun.position.set(-8, 14, -6); sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun);
    return { curve, pts, N, TW, tang, boosts, startAngle: ang0 };
  }

  // 依賽道位置放車：k = 中心線上第幾點，off = 往左右偏移
  function place(world, car, k, off) {
    const N = world.N, kk = ((k % N) + N) % N;
    const p = world.pts[Math.floor(kk)], t = world.tang(Math.floor(kk)), nx = -t.z, nz = t.x;
    car.position.set(p.x + nx * off, 0, p.z + nz * off);
    car.rotation.y = Math.atan2(t.x, t.z);
  }

  return { kart, buildWorld, place, CAR_COLORS };
})();
