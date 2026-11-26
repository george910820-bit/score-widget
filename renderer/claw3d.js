// 3D 夾娃娃機模型（全部用 three.js 的基本形狀組出來，不需要外部模型檔）
// ClawModel.create(canvas) → { scene, camera, renderer, setView, render, claw, gantry, prizes, ... }
window.ClawModel = (() => {
  'use strict';
  const T = () => window.THREE;

  // ---------- 小工具：用 canvas 畫貼圖 ----------
  function canvasTex(w, h, draw, repeat) {
    const THREE = T();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const starTex = (() => { let t = null; return () => t || (t = canvasTex(64, 64, (g, w) => { g.translate(32, 32); const r = g.createRadialGradient(0, 0, 0, 0, 0, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 5 : 30; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); })); })();
  const glowTex = (() => { let t = null; return () => t || (t = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); })); })();

  // ---------- 材質 ----------
  function mats() {
    const THREE = T();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    return {
      red: std({ color: 0xd81b3c, roughness: 0.35, metalness: 0.1 }),
      darkRed: std({ color: 0x8e0f25, roughness: 0.5 }),
      gold: std({ color: 0xffc233, roughness: 0.25, metalness: 0.85 }),
      chrome: std({ color: 0xeeeeee, roughness: 0.12, metalness: 1 }),
      black: std({ color: 0x15151c, roughness: 0.6 }),
      white: std({ color: 0xffffff, roughness: 0.4 }),
      panel: std({ color: 0x2a2a35, roughness: 0.45, metalness: 0.3 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false }),
      acrylic: new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.28, roughness: 0.05, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false })
    };
  }

  // ---------- 娃娃（3D 絨毛玩偶） ----------
  const PLUSH_TYPES = ['bear', 'bunny', 'cat', 'pig', 'frog', 'chick', 'panda', 'dog', 'unicorn', 'mouse'];
  const PLUSH_COLORS = {
    bear: [0x8a4517, 0xffc97a], bunny: [0xff8fc4, 0xffffff], cat: [0xff7300, 0xfff0d0], pig: [0xff5c9a, 0xff2f7d],
    frog: [0x1fbf2f, 0xc6ff7a], chick: [0xffcc00, 0xfff07a], panda: [0xffffff, 0x151515], dog: [0xe08a2e, 0x6b3410],
    unicorn: [0xc89bff, 0xff4fc3], mouse: [0x3d8bff, 0xffb0cf]
  };
  const PLUSH_NAMES = { bear: '小熊', bunny: '兔兔', cat: '貓咪', pig: '小豬', frog: '青蛙', chick: '小雞', panda: '熊貓', dog: '小狗', unicorn: '獨角獸', mouse: '老鼠' };
  function plush(type, gold) {
    const THREE = T();
    const [main, accent] = gold ? [0xffc21a, 0xfff1a8] : PLUSH_COLORS[type];
    const fuzzy = gold
      ? (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.85, clearcoat: 0.6, envMapIntensity: 1.6 })
      : (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.86, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35), envMapIntensity: 0.35 });
    const M = fuzzy(main), A = fuzzy(accent);
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15 });
    const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const cheekM = new THREE.MeshStandardMaterial({ color: 0xff7aa8, roughness: 0.8, transparent: true, opacity: 0.75 });
    const g = new THREE.Group();
    const S = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, seg = 24) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg * 0.75 | 0), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    // 身體、頭
    S(0.07, type === 'panda' ? M : M, 0, 0.068, 0, 1.05, 0.95, 0.92);
    const headY = 0.165;
    S(0.068, M, 0, headY, 0.008, 1.08, 0.98, 1);
    // 肚子
    S(0.045, A === M ? M : (type === 'panda' ? M : A), 0, 0.06, 0.04, 1, 1.05, 0.6);
    // 手腳
    const limbM = type === 'panda' ? A : M;
    S(0.026, limbM, -0.066, 0.085, 0.025, 1, 1.3, 1); S(0.026, limbM, 0.066, 0.085, 0.025, 1, 1.3, 1);
    S(0.03, limbM, -0.04, 0.018, 0.05, 1, 0.8, 1.25); S(0.03, limbM, 0.04, 0.018, 0.05, 1, 0.8, 1.25);
    // 眼睛
    const eye = (x) => { S(0.0105, eyeM, x, headY + 0.008, 0.066, 1, 1.15, 0.6, 16); S(0.0035, shineM, x + 0.004, headY + 0.013, 0.072, 1, 1, 1, 8); };
    if (type === 'panda') { S(0.02, A, -0.026, headY + 0.006, 0.058, 1, 1.3, 0.5); S(0.02, A, 0.026, headY + 0.006, 0.058, 1, 1.3, 0.5); }
    if (type === 'frog') { S(0.026, M, -0.03, headY + 0.055, 0.03); S(0.026, M, 0.03, headY + 0.055, 0.03); const fe = (x) => { S(0.012, eyeM, x, headY + 0.06, 0.052, 1, 1, 0.6, 16); S(0.004, shineM, x + 0.004, headY + 0.066, 0.06, 1, 1, 1, 8); }; fe(-0.03); fe(0.03); }
    else { eye(-0.027); eye(0.027); }
    // 臉頰
    if (type !== 'panda') { S(0.012, cheekM, -0.046, headY - 0.014, 0.05, 1, 0.6, 0.3, 12); S(0.012, cheekM, 0.046, headY - 0.014, 0.05, 1, 0.6, 0.3, 12); }
    // 嘴巴／鼻子
    const noseM = new THREE.MeshStandardMaterial({ color: 0x3a2020, roughness: 0.4 });
    if (type === 'pig') { const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 24), A); sn.rotation.x = Math.PI / 2; sn.position.set(0, headY - 0.016, 0.07); g.add(sn); S(0.004, noseM, -0.008, headY - 0.016, 0.081, 1, 1.4, 0.5, 8); S(0.004, noseM, 0.008, headY - 0.016, 0.081, 1, 1.4, 0.5, 8); }
    else if (type === 'chick') { const bk = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.026, 16), new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.5 })); bk.rotation.x = Math.PI / 2; bk.position.set(0, headY - 0.012, 0.078); g.add(bk); }
    else if (type !== 'frog') { S(0.02, type === 'panda' || type === 'unicorn' ? M : A, 0, headY - 0.02, 0.058, 1.2, 0.85, 0.7); S(0.007, noseM, 0, headY - 0.012, 0.072, 1.3, 1, 0.8, 12); }
    else { const sm = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 8, 24, Math.PI), noseM); sm.rotation.z = Math.PI; sm.position.set(0, headY - 0.012, 0.066); g.add(sm); }
    // 耳朵
    const earM = type === 'panda' ? A : M;
    if (type === 'bear' || type === 'panda' || type === 'mouse') {
      const r = type === 'mouse' ? 0.032 : 0.022;
      [-1, 1].forEach((s) => { S(r, earM, s * (type === 'mouse' ? 0.058 : 0.052), headY + 0.058, -0.004, 1, 1, 0.55); S(r * 0.55, A === earM ? M : (type === 'panda' ? earM : A), s * (type === 'mouse' ? 0.058 : 0.052), headY + 0.058, 0.006, 1, 1, 0.4); });
    } else if (type === 'bunny') {
      [-1, 1].forEach((s) => { const e = S(0.018, M, s * 0.026, headY + 0.1, -0.005, 1, 3, 0.6); e.rotation.z = -s * 0.15; const ei = S(0.01, A, s * 0.026, headY + 0.1, 0.004, 1, 2.5, 0.4); ei.rotation.z = -s * 0.15; });
    } else if (type === 'cat' || type === 'pig') {
      [-1, 1].forEach((s) => { const c = new THREE.Mesh(new THREE.ConeGeometry(type === 'pig' ? 0.02 : 0.024, type === 'pig' ? 0.03 : 0.042, 16), M); c.position.set(s * 0.042, headY + 0.065, 0); c.rotation.z = -s * 0.35; c.scale.z = 0.6; c.castShadow = true; g.add(c); });
      if (type === 'cat') { const tail = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 24, Math.PI * 1.2), M); tail.position.set(0.04, 0.07, -0.07); tail.rotation.y = Math.PI / 2; g.add(tail); }
    } else if (type === 'dog') {
      [-1, 1].forEach((s) => { const e = S(0.024, A, s * 0.066, headY + 0.005, 0, 0.6, 1.6, 0.9); e.rotation.z = s * 0.3; });
    } else if (type === 'chick') {
      S(0.012, M, 0, headY + 0.07, 0, 0.7, 1.6, 0.7); S(0.01, M, 0.01, headY + 0.066, 0, 0.6, 1.4, 0.6);
      [-1, 1].forEach((s) => S(0.03, M, s * 0.07, 0.08, 0, 0.5, 1, 1.3));
    } else if (type === 'unicorn') {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.6, roughness: 0.25 }));
      horn.position.set(0, headY + 0.085, 0.02); horn.rotation.x = 0.25; g.add(horn);
      [-1, 1].forEach((s) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 12), M); c.position.set(s * 0.042, headY + 0.06, -0.01); c.rotation.z = -s * 0.3; g.add(c); });
      S(0.03, A, 0, headY + 0.03, -0.05, 0.6, 1.4, 1); // 鬃毛
    }
    if (gold) {
      // 金色娃娃：皇冠＋閃光
      const crownM = new THREE.MeshStandardMaterial({ color: 0xffe066, metalness: 1, roughness: 0.2, emissive: 0x664400, emissiveIntensity: 0.4 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.026, 5, 1, true), crownM); crown.position.set(0, 0.245, 0); g.add(crown);
      for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 8), crownM); const a = k / 5 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.032, 0.267, Math.sin(a) * 0.032); g.add(sp); }
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.8 })); gem.position.set(0, 0.248, 0.034); g.add(gem);
      const sparks = [];
      for (let k = 0; k < 4; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), color: 0xfff3b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.position.set((Math.random() - 0.5) * 0.18, 0.05 + Math.random() * 0.22, 0.05 + Math.random() * 0.05); sp.scale.setScalar(0.05); sp.userData.ph = Math.random() * 6; g.add(sp); sparks.push(sp);
      }
      g.userData.sparks = sparks;
    }
    g.userData.type = type; g.userData.gold = !!gold;
    return g;
  }

  // ---------- 整台機器 ----------
  function create(canvas, opt = {}) {
    const THREE = T();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: !!opt.preserve });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.background = canvasTex(16, 256, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#120a2a'); r.addColorStop(0.6, '#2a1046'); r.addColorStop(1, '#0b0716'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 30);
    const m = mats();
    const root = new THREE.Group(); scene.add(root);
    const box = (w, h, d, mat, x, y, z, parent = root, r = 0) => {
      const geo = r ? new THREE.RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d);
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
    };
    const cyl = (rt, rb, h, mat, x, y, z, parent = root, seg = 32) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

    // 尺寸（公尺）：機台寬 1.0、深 0.9；玻璃箱 y 0.88～1.74
    const W = 1.0, D = 0.9, BASE = 0.86, GT = 1.74, IN = { x: 0.455, z: 0.405 };
    const FLOOR = BASE + 0.03;

    // --- 環境：地毯、遠處的霓虹 ---
    const carpet = canvasTex(256, 256, (g, w) => {
      g.fillStyle = '#1b1035'; g.fillRect(0, 0, w, w);
      const cs = ['#ff3d7f', '#00e5ff', '#ffd54f', '#7c4dff', '#69f0ae'];
      for (let i = 0; i < 70; i++) { g.strokeStyle = cs[i % cs.length]; g.lineWidth = 3; g.beginPath(); const x = Math.random() * w, y = Math.random() * w; if (i % 3 === 0) g.arc(x, y, 6 + Math.random() * 8, 0, Math.PI * 2); else { g.moveTo(x, y); g.lineTo(x + 14, y + 10); g.lineTo(x + 2, y + 20); } g.stroke(); }
    }, [8, 8]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ color: 0x1a1230, roughness: 0.9 }));
    back.position.set(0, 3, -2.6); scene.add(back);
    [[-1.7, 1.9, -2.55, 0xff2d95], [1.6, 2.2, -2.55, 0x00e5ff], [0.2, 2.6, -2.55, 0xffd54f]].forEach(([x, y, z, c]) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 12, 48), new THREE.MeshBasicMaterial({ color: c }));
      ring.position.set(x, y, z); scene.add(ring);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(1.6, 1.6, 1); sp.position.set(x, y, z + 0.05); scene.add(sp);
    });

    // --- 下半部機身 ---
    box(W, BASE, D, m.red, 0, BASE / 2, 0, root, 0.03);
    box(W + 0.02, 0.05, D + 0.02, m.gold, 0, BASE - 0.01, 0, root, 0.015);   // 金色腰帶
    box(W + 0.02, 0.06, D + 0.02, m.black, 0, 0.03, 0, root, 0.01);          // 底座
    // 前面的裝飾板（星星貼圖）
    const deco = canvasTex(512, 320, (g, w, h) => {
      const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#ff4f8b'); r.addColorStop(1, '#b0123a'); g.fillStyle = r; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, s = 6 + Math.random() * 14; g.fillStyle = ['#ffe082', '#fff', '#80deea'][i % 3]; g.globalAlpha = 0.5; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
      g.globalAlpha = 1; g.font = 'bold 58px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#7a0020'; g.lineWidth = 10;
      g.strokeText('幸運夾夾樂', w * 0.68, h * 0.6); g.fillText('幸運夾夾樂', w * 0.68, h * 0.6);
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, 0.5), new THREE.MeshStandardMaterial({ map: deco, roughness: 0.4 }));
    front.position.set(0, 0.36, D / 2 + 0.001); root.add(front);

    // --- 出口（左下）：凹進去的取物口＋透明擋板＋金框 ---
    const doorX = -0.3, doorY = 0.33;
    { const cm = new THREE.MeshStandardMaterial({ color: 0x3a1a5a, roughness: 0.8, emissive: 0x2a0f45, emissiveIntensity: 0.6, side: THREE.BackSide }); const hide = new THREE.MeshBasicMaterial({ visible: false });
      const cav = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.08), [cm, cm, cm, cm, hide, cm]); cav.position.set(doorX, doorY, D / 2 + 0.04); root.add(cav);
      const ccut = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })); ccut.position.set(doorX, doorY, D / 2 + 0.0005); }
    { const shell = (w, h, x, y) => box(w, h, 0.08, m.red, doorX + x, doorY + y, D / 2 + 0.04, root); shell(0.3, 0.02, 0, 0.13); shell(0.3, 0.02, 0, -0.13); shell(0.02, 0.28, -0.14, 0); shell(0.02, 0.28, 0.14, 0); }
    const doorLight = new THREE.PointLight(0xffe0b2, 0.6, 0.5); doorLight.position.set(doorX, doorY + 0.08, D / 2 + 0.05); root.add(doorLight); // 凹洞（裡面有一點燈光）
    const doorFrame = new THREE.Group(); doorFrame.position.set(doorX, doorY, D / 2 + 0.085); root.add(doorFrame);
    box(0.3, 0.025, 0.03, m.gold, 0, 0.13, 0, doorFrame, 0.008); box(0.3, 0.025, 0.03, m.gold, 0, -0.13, 0, doorFrame, 0.008);
    box(0.025, 0.28, 0.03, m.gold, -0.14, 0, 0, doorFrame, 0.008); box(0.025, 0.28, 0.03, m.gold, 0.14, 0, 0, doorFrame, 0.008);
    const flapPivot = new THREE.Group(); flapPivot.position.set(0, 0.12, 0.005); doorFrame.add(flapPivot);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.235, 0.006), new THREE.MeshPhysicalMaterial({ color: 0xffb74d, transparent: true, opacity: 0.32, roughness: 0.05, envMapIntensity: 1.5 }));
    flap.position.y = -0.118; flapPivot.add(flap);
    const pushTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#ffd54f'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a0020'; g.font = 'bold 40px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('出口 ▼ 推', w / 2, h / 2 + 2); });
    const pushSign = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: pushTex, roughness: 0.4 }));
    pushSign.position.set(doorX, doorY + 0.175, D / 2 + 0.003); root.add(pushSign);
    const prizeSlot = new THREE.Group(); prizeSlot.position.set(doorX, doorY - 0.115, D / 2 + 0.03); root.add(prizeSlot); // 掉出來的娃娃放這裡

    // --- 操作台：斜面＋搖桿＋夾按鈕＋投幣口 ---
    const panel = new THREE.Group(); panel.position.set(0, BASE - 0.02, D / 2 + 0.1); panel.rotation.x = 0.32; root.add(panel);
    box(W - 0.02, 0.06, 0.26, m.panel, 0, 0, 0, panel, 0.02);
    box(W, 0.02, 0.27, m.gold, 0, -0.035, 0.003, panel, 0.008);
    const stickBase = cyl(0.05, 0.055, 0.02, m.black, -0.22, 0.04, 0, panel);
    const stick = new THREE.Group(); stick.position.set(-0.22, 0.05, 0); panel.add(stick);
    cyl(0.009, 0.009, 0.13, m.chrome, 0, 0.065, 0, stick);
    const starTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#ff8f1f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe9a8'; for (const cx of [w * 0.25, w * 0.75]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? 14 : 30; g.lineTo(cx + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); } g.fill(); } });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.042, 32, 24), new THREE.MeshPhysicalMaterial({ map: starTex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
    ball.position.y = 0.14; ball.castShadow = true; stick.add(ball);
    const btnTex = canvasTex(256, 256, (g, w) => { const r = g.createRadialGradient(w * 0.4, w * 0.35, 10, w / 2, w / 2, w / 2); r.addColorStop(0, '#7dff9a'); r.addColorStop(1, '#0f8a3a'); g.fillStyle = r; g.fillRect(0, 0, w, w); g.fillStyle = '#fff'; g.font = 'bold 110px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = '#0a5c26'; g.lineWidth = 12; g.strokeText('夾', w / 2, w / 2 + 6); g.fillText('夾', w / 2, w / 2 + 6); });
    cyl(0.07, 0.074, 0.025, m.chrome, 0.16, 0.035, 0, panel);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.062, 0.035, 40), [new THREE.MeshPhysicalMaterial({ color: 0x18b04a, roughness: 0.2, clearcoat: 1 }), new THREE.MeshPhysicalMaterial({ map: btnTex, roughness: 0.15, clearcoat: 1, emissive: 0x0b5c22, emissiveIntensity: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x18b04a })]);
    btn.position.set(0.16, 0.06, 0); btn.castShadow = true; panel.add(btn);
    // 入場券投入口＋顯示
    const coinTex = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#100'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3b3b'; g.font = 'bold 54px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff0000'; g.shadowBlur = 12; g.fillText('券 x 1', w / 2, h / 2 + 3); });
    const coin = box(0.15, 0.05, 0.08, m.black, 0.38, 0.035, 0, panel, 0.01);
    const coinScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: coinTex }));
    coinScreen.rotation.x = -Math.PI / 2; coinScreen.position.set(0.38, 0.061, -0.005); panel.add(coinScreen);

    // --- 玻璃箱 ---
    const glassH = GT - BASE;
    const glassY = BASE + glassH / 2;
    // 內部底板（娃娃床）
    const bed = canvasTex(256, 256, (g, w) => { g.fillStyle = '#f7b6d2'; g.fillRect(0, 0, w, w); g.fillStyle = '#ffd6e8'; for (let y = 0; y < w; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); } }, [3, 3]);
    box(IN.x * 2, 0.03, IN.z * 2, new THREE.MeshStandardMaterial({ map: bed, roughness: 0.9 }), 0, BASE + 0.015, 0);
    // 後牆：白色磁磚（像參考圖）
    const tiles = canvasTex(512, 512, (g, w) => { g.fillStyle = '#c9ccd6'; g.fillRect(0, 0, w, w); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const gr = g.createLinearGradient(x * 64, y * 64, x * 64 + 64, y * 64 + 64); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e4e7ef'); g.fillStyle = gr; g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); } });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(IN.x * 2, glassH), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.25, metalness: 0.05 }));
    backWall.position.set(0, glassY, -IN.z); backWall.receiveShadow = true; root.add(backWall);
    // 後牆上的小海報
    const poster = canvasTex(256, 360, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#3949ab'); r.addColorStop(1, '#8e24aa'); g.fillStyle = r; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd54f'; g.font = 'bold 56px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; g.textAlign = 'center'; g.fillText('夾到', w / 2, 120); g.fillText('就是你的', w / 2, 190); g.font = '120px sans-serif'; g.fillText('🧸', w / 2, 320); });
    const pst = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.24), new THREE.MeshStandardMaterial({ map: poster, roughness: 0.5 }));
    pst.position.set(-0.27, glassY + 0.16, -IN.z + 0.004); root.add(pst);
    // 玻璃（前、左、右）
    const glass = (w, h, x, y, z, ry) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.glass); o.position.set(x, y, z); o.rotation.y = ry; o.renderOrder = 10; root.add(o); return o; };
    glass(IN.x * 2, glassH, 0, glassY, IN.z, 0);
    glass(IN.z * 2, glassH, -IN.x, glassY, 0, Math.PI / 2);
    glass(IN.z * 2, glassH, IN.x, glassY, 0, Math.PI / 2);
    // 玻璃上的反光條
    const streak = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false });
    [[-0.28, 0.05], [-0.18, 0.025], [0.3, 0.035]].forEach(([x, w]) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, glassH * 1.1), streak); s.position.set(x, glassY, IN.z + 0.002); s.rotation.z = -0.35; s.renderOrder = 11; root.add(s); });
    // 四根鍍鉻柱
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(0.016, 0.016, glassH, m.chrome, sx * IN.x, glassY, sz * IN.z));
    // 前面紅色框柱＋燈泡
    const bulbs = [];
    const bulbMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.3 });
    const addBulb = (x, y, z, c, parent = root) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), bulbMat(c)); b.position.set(x, y, z); parent.add(b);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(0.09, 0.09, 1); sp.position.set(x, y, z + 0.01); parent.add(sp);
      bulbs.push({ b, sp, c: new THREE.Color(c) });
    };
    [-1, 1].forEach((s) => {
      box(0.075, glassH + 0.02, 0.07, m.red, s * (IN.x + 0.035), glassY, IN.z + 0.01, root, 0.015);
      box(0.02, glassH, 0.075, m.gold, s * (IN.x - 0.002), glassY, IN.z + 0.012, root, 0.006);
      for (let i = 0; i < 8; i++) addBulb(s * (IN.x + 0.035), BASE + 0.06 + i * 0.105, IN.z + 0.05, [0xfff3b0, 0xffffff][i % 2]);
    });
    // 側面框
    [-1, 1].forEach((s) => { box(0.03, glassH, 0.03, m.red, s * (IN.x + 0.01), glassY, -IN.z - 0.005); });
    box(IN.x * 2 + 0.1, 0.03, 0.06, m.gold, 0, BASE + 0.015, IN.z + 0.02, root, 0.01);

    // --- 頂部：招牌 ---
    const top = new THREE.Group(); top.position.set(0, GT, 0); root.add(top);
    box(W, 0.06, D, m.red, 0, 0.03, 0, top, 0.02);
    box(W + 0.02, 0.025, D + 0.02, m.gold, 0, 0.005, 0, top, 0.01);
    const sign = canvasTex(1024, 300, (g, w, h) => {
      const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#ff5fa2'); r.addColorStop(1, '#d81b60'); g.fillStyle = r; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 10, 0, Math.PI * 2); g.fill(); }
      const txt = ['夾', '娃', '娃', '機'], cols = ['#ffeb3b', '#69f0ae', '#40c4ff', '#ff9100'];
      g.font = '900 190px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      txt.forEach((t, i) => { const x = w * (0.2 + i * 0.2), y = h / 2 + 10 + (i % 2 ? -10 : 8); g.save(); g.translate(x, y); g.rotate((i - 1.5) * 0.06); g.lineWidth = 22; g.strokeStyle = '#7a0030'; g.strokeText(t, 0, 0); g.fillStyle = cols[i]; g.fillText(t, 0, 0); g.restore(); });
    });
    const signMesh = box(W - 0.04, 0.3, 0.1, [m.red, m.red, m.red, m.red, new THREE.MeshStandardMaterial({ map: sign, roughness: 0.35, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.35 }), m.red], 0, 0.21, D / 2 - 0.06, top);
    box(W, 0.035, 0.12, m.gold, 0, 0.375, D / 2 - 0.06, top, 0.012);
    box(W - 0.04, 0.3, D - 0.15, m.darkRed, 0, 0.21, -0.07, top, 0.02);
    for (let i = 0; i < 14; i++) addBulb(-0.465 + i * (0.93 / 13), GT + 0.4, D / 2 - 0.0, [0xff4f8b, 0xffe066, 0x4fc3ff][i % 3]);
    for (let i = 0; i < 4; i++) { addBulb(-0.49, GT + 0.09 + i * 0.075, D / 2 - 0.0, 0xfff3b0); addBulb(0.49, GT + 0.09 + i * 0.075, D / 2 - 0.0, 0xfff3b0); }

    // --- 天車：左右兩條軌道、前後移動的橫桿、左右移動的台車 ---
    const railY = GT - 0.035;
    [-1, 1].forEach((s) => box(0.025, 0.025, IN.z * 2, m.gold, s * (IN.x - 0.02), railY, 0));
    const gantry = new THREE.Group(); root.add(gantry);
    box(IN.x * 2 - 0.02, 0.022, 0.035, m.chrome, 0, railY - 0.02, 0, gantry);
    const carriage = new THREE.Group(); gantry.add(carriage);
    box(0.08, 0.045, 0.07, m.gold, 0, railY - 0.045, 0, carriage, 0.01);
    // 繩子
    const cable = cyl(0.0035, 0.0035, 1, m.chrome, 0, 0, 0, carriage, 8);
    // 爪子
    const claw = new THREE.Group(); carriage.add(claw);
    cyl(0.028, 0.034, 0.05, m.chrome, 0, 0.025, 0, claw);
    cyl(0.04, 0.04, 0.018, m.gold, 0, -0.005, 0, claw);
    const prongs = [];
    const prongCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, -0.03, 0), new THREE.Vector3(0.052, -0.085, 0), new THREE.Vector3(0.04, -0.14, 0), new THREE.Vector3(0.012, -0.165, 0)]);
    const prongGeo = new THREE.TubeGeometry(prongCurve, 24, 0.0065, 10, false);
    for (let k = 0; k < 3; k++) {
      const pv = new THREE.Group(); pv.rotation.y = k * Math.PI * 2 / 3; pv.position.y = -0.012; claw.add(pv);
      const hinge = new THREE.Group(); hinge.position.x = 0.022; pv.add(hinge);
      const p = new THREE.Mesh(prongGeo, m.chrome); p.castShadow = true; hinge.add(p);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), new THREE.MeshStandardMaterial({ color: 0x00bcd4, roughness: 0.5 })); tip.position.set(0.012, -0.165, 0); hinge.add(tip);
      prongs.push(hinge);
    }
    const heldSlot = new THREE.Group(); heldSlot.position.y = -0.2; claw.add(heldSlot); // 夾住的娃娃放這裡
    // 爪子正下方的影子圈（幫忙看前後）
    const aimTex = canvasTex(128, 128, (g, w) => { g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.setLineDash([16, 9]); g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 8, 0, Math.PI * 2); g.stroke(); const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fill(); });
    const aim = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: aimTex, transparent: true, depthWrite: false, depthTest: false, color: 0xffffff }));
    aim.rotation.x = -Math.PI / 2; aim.renderOrder = 20; root.add(aim);

    // --- 出口筒（玻璃箱左前角）：彩色壓克力方筒＋金色口緣＋發光條＋斜滑道 ---
    const CH = { x: -IN.x + 0.115, z: IN.z - 0.115, s: 0.21, h: 0.22 };
    const chute = new THREE.Group(); chute.position.set(CH.x, FLOOR, CH.z); root.add(chute);
    const acr = new THREE.MeshPhysicalMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.42, roughness: 0.08, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false });
    const wall = (w, x, z, ry) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, CH.h), acr); o.position.set(x, CH.h / 2, z); o.rotation.y = ry; o.renderOrder = 9; chute.add(o); };
    wall(CH.s, 0, -CH.s / 2, 0); wall(CH.s, 0, CH.s / 2, 0); wall(CH.s, -CH.s / 2, 0, Math.PI / 2); wall(CH.s, CH.s / 2, 0, Math.PI / 2);
    // 筒子裡面：往下的斜滑道（深色）＋底部的洞
    const inside = new THREE.Mesh(new THREE.BoxGeometry(CH.s - 0.01, 0.01, CH.s - 0.01), new THREE.MeshStandardMaterial({ color: 0x0a0414, roughness: 0.9 }));
    inside.position.y = 0.01; chute.add(inside);
    const slide = new THREE.Mesh(new THREE.PlaneGeometry(CH.s - 0.02, CH.s * 0.9), new THREE.MeshStandardMaterial({ color: 0x2b1a4a, roughness: 0.6, side: THREE.DoubleSide }));
    slide.rotation.x = -Math.PI / 2 + 0.55; slide.position.set(0, 0.07, -0.01); chute.add(slide);
    // 金色口緣（四邊，有一點厚度）
    [[0, -CH.s / 2, CH.s + 0.03, 0.025], [0, CH.s / 2, CH.s + 0.03, 0.025]].forEach(([x, z, w, d]) => box(w, 0.022, d, m.gold, x, CH.h, z, chute, 0.008));
    [[-CH.s / 2, 0], [CH.s / 2, 0]].forEach(([x, z]) => box(0.025, 0.022, CH.s + 0.03, m.gold, x, CH.h, z, chute, 0.008));
    // 四個角的鍍鉻小柱
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(0.008, 0.008, CH.h, m.chrome, sx * CH.s / 2, CH.h / 2, sz * CH.s / 2, chute, 12));
    // 發光條（兩圈）
    const neonM = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
    [CH.h * 0.35, CH.h * 0.7].forEach((y) => {
      [[0, -CH.s / 2 - 0.002, 0], [0, CH.s / 2 + 0.002, 0], [-CH.s / 2 - 0.002, 0, Math.PI / 2], [CH.s / 2 + 0.002, 0, Math.PI / 2]].forEach(([x, z, ry]) => {
        const n = new THREE.Mesh(new THREE.BoxGeometry(CH.s, 0.008, 0.004), neonM); n.position.set(x, y, z); n.rotation.y = ry; chute.add(n);
      });
    });
    const chuteGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff4fd8, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    chuteGlow.scale.set(0.45, 0.45, 1); chuteGlow.position.set(0, CH.h * 0.5, 0); chute.add(chuteGlow);
    // 立在口緣上的小招牌
    const chuteSign = canvasTex(256, 110, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#ffeb3b'); r.addColorStop(1, '#ff9800'); g.fillStyle = r; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#b3002d'; g.font = '900 64px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('出口', w / 2, h / 2 + 3); });
    const csign = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.056), new THREE.MeshStandardMaterial({ map: chuteSign, transparent: true, roughness: 0.4, emissive: 0xffffff, emissiveMap: chuteSign, emissiveIntensity: 0.25 }));
    csign.position.set(0.0, CH.h + 0.045, CH.s / 2 + 0.006); chute.add(csign);
    cyl(0.004, 0.004, 0.03, m.chrome, -0.04, CH.h + 0.015, CH.s / 2 + 0.006, chute, 8); cyl(0.004, 0.004, 0.03, m.chrome, 0.04, CH.h + 0.015, CH.s / 2 + 0.006, chute, 8);

    // --- 娃娃 ---
    const prizeGroup = new THREE.Group(); root.add(prizeGroup);
    const prizes = [];
    function addPrize(type, x, z, y = FLOOR, ry = 0, tilt = 0, gold = false) {
      const p = plush(type, gold); p.position.set(x, y, z); p.rotation.set(tilt, ry, tilt * 0.5); p.scale.setScalar(0.92 + Math.random() * 0.12);
      prizeGroup.add(p); prizes.push(p); return p;
    }
    const inChute = (x, z) => x < CH.x + CH.s / 2 + 0.07 && z > CH.z - CH.s / 2 - 0.07;
    function fillPrizes(seed) {
      prizes.splice(0).forEach((p) => prizeGroup.remove(p));
      let s = seed || 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const spots = [];
      for (let iz = 0; iz < 4; iz++) for (let ix = 0; ix < 5; ix++) {
        const x = -0.36 + ix * 0.18 + (rnd() - 0.5) * 0.05, z = -0.3 + iz * 0.19 + (rnd() - 0.5) * 0.05;
        if (!inChute(x, z)) spots.push([x, z]);
      }
      spots.forEach(([x, z], i) => addPrize(PLUSH_TYPES[i % PLUSH_TYPES.length], x, z, FLOOR, (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.35));
      // 第二層：疊在中間
      [[-0.18, -0.2], [0.1, -0.1], [0.28, 0.05], [-0.02, 0.12]].forEach(([x, z], i) => addPrize(PLUSH_TYPES[(i * 3 + 2) % PLUSH_TYPES.length], x, z, FLOOR + 0.09, (rnd() - 0.5) * 2, -0.5 + rnd() * 0.3));
      // 稀有的金色娃娃（opt.gold 隻）
      for (let k = 0; k < (opt.gold ?? 1); k++) {
        const want = [[0.2, -0.05], [-0.1, 0.05], [0.3, -0.25]][k % 3];
        let i = 0, bd = 9; prizes.forEach((q, j) => { const d = Math.hypot(q.position.x - want[0], q.position.z - want[1]) - (q.position.y > FLOOR + 0.05 ? 0.2 : 0); if (!q.userData.gold && d < bd) { bd = d; i = j; } });
        const old = prizes[i];
        prizeGroup.remove(old); prizes.splice(i, 1);
        addPrize(PLUSH_TYPES[Math.floor(rnd() * PLUSH_TYPES.length)], old.position.x, old.position.z, old.position.y, old.rotation.y, old.rotation.x, true);
      }
    }
    fillPrizes(7);

    // --- 燈光 ---
    scene.add(new THREE.HemisphereLight(0xffe6f2, 0x221133, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1.5, 3.2, 2.4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2; key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -0.5; key.shadow.bias = -0.0005; scene.add(key);
    const inner = new THREE.SpotLight(0xfff4e8, 2.2, 2, 0.95, 0.5, 1.2); inner.position.set(0, GT - 0.05, 0.1); inner.target.position.set(0, BASE, 0); inner.castShadow = true; inner.shadow.mapSize.set(1024, 1024); scene.add(inner, inner.target);
    const pinkFill = new THREE.PointLight(0xff4f9a, 1.2, 3); pinkFill.position.set(-1.2, 1.4, 1.2); scene.add(pinkFill);
    const blueFill = new THREE.PointLight(0x40c4ff, 1.0, 3); blueFill.position.set(1.3, 1.2, 1.0); scene.add(blueFill);

    // --- 狀態：爪子位置、開合 ---
    const state = { x: 0.1, z: 0.05, y: GT - 0.16, open: 0.25 };
    const LIM = { x: IN.x - 0.07, z: IN.z - 0.07 };
    function apply(t) {
      gantry.position.z = state.z;
      carriage.position.x = state.x;
      const cy = state.y;
      claw.position.y = cy;
      const top = railY - 0.07, len = Math.max(0.01, top - (cy + 0.05));
      cable.scale.y = len; cable.position.y = cy + 0.05 + len / 2;
      prongs.forEach((h) => { h.rotation.z = 0.15 + state.open * 0.55; });
      aim.position.set(state.x, FLOOR + 0.004, state.z);
      stick.rotation.set(-(state.vz || 0) * 0.35, 0, -(state.vx || 0) * 0.35);
      // 金色娃娃閃閃發光
      if (t !== undefined) prizes.forEach((p) => (p.userData.sparks || []).forEach((sp) => { const k = Math.max(0, Math.sin(t * 3 + sp.userData.ph)); sp.material.opacity = k; sp.scale.setScalar(0.02 + k * 0.05); }));
      // 燈泡跑馬燈
      if (t !== undefined) bulbs.forEach((o, i) => { const on = Math.sin(t * 6 - i * 0.7) > -0.2; o.b.material.emissiveIntensity = on ? 1.8 : 0.25; o.sp.material.opacity = on ? 0.8 : 0.1; });
    }
    const VIEWS = {
      player: { p: [0, 1.52, 1.55], t: [0, 1.12, 0], fov: 40 },
      full: { p: [1.75, 1.9, 2.9], t: [0, 1.08, 0], fov: 38 },
      side: { p: [1.75, 1.42, 0.05], t: [0, 1.12, 0], fov: 40 },
      prizes: { p: [0.18, 1.32, 0.78], t: [0.02, 0.96, -0.05], fov: 42 },
      claw: { p: [0.35, 1.55, 0.6], t: [0.1, 1.45, 0.05], fov: 34 },
      front: { p: [0, 1.15, 3.1], t: [0, 1.05, 0], fov: 38 }
    };
    function setView(name) { const v = VIEWS[name] || VIEWS.player; camera.position.set(...v.p); camera.fov = v.fov; camera.lookAt(...v.t); camera.updateProjectionMatrix(); }
    function resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    function render(t) { apply(t); renderer.render(scene, camera); }
    setView('player');
    return { THREE, scene, camera, root, railY, setViewVec: (p, tg, fov) => { camera.position.set(...p); camera.fov = fov; camera.lookAt(...tg); camera.updateProjectionMatrix(); }, renderer, setView, resize, render, state, LIM, FLOOR, GT, IN, prizes, panel, prongs, prizeGroup, fillPrizes, addPrize, plush, heldSlot, prizeSlot, flapPivot, chute: CH, aim, claw, carriage, gantry, bulbs, btn, stick, VIEWS };
  }

  // 收藏冊用的縮圖：每一種娃娃拍一張照片（dataURL）
  let thumbCache = null;
  function thumbs() {
    if (thumbCache) return thumbCache;
    const THREE = T();
    const cv = document.createElement('canvas'); cv.width = cv.height = 160;
    let r;
    try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping;
    const sc = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x444466, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1, 2, 2); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 5); cam.position.set(0.12, 0.2, 0.62); cam.lookAt(0, 0.125, 0);
    thumbCache = {};
    PLUSH_TYPES.forEach((tp) => [false, true].forEach((gd) => {
      const p = plush(tp, gd); p.rotation.y = -0.25; sc.add(p);
      r.render(sc, cam);
      thumbCache[(gd ? 'gold:' : '') + tp] = cv.toDataURL('image/png');
      sc.remove(p);
    }));
    r.dispose(); pm.dispose();
    return thumbCache;
  }

  return { create, plush, thumbs, PLUSH_TYPES, PLUSH_NAMES };
})();
