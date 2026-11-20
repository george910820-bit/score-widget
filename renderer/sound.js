// 音效：內建音效用程式即時合成（沒有版權問題），也可以換成老師自己的音檔
window.Sound = (() => {
  'use strict';
  let ctx = null;
  let cfg = { on: true, volume: 70, plus: null, minus: null };
  let baseUrl = '';
  const cache = {};

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const vol = () => Math.max(0, Math.min(1, (Number(cfg.volume) || 0) / 100));

  // 一個音符：頻率、開始時間、長度、波形、音量
  function tone(freq, start, dur, type = 'triangle', gain = 0.25, slideTo = null) {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime + start;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * vol()), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  let noise = null;
  function noiseBuf(a) {
    if (noise) return noise;
    noise = a.createBuffer(1, a.sampleRate * 0.2, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }

  function playFile(rel) {
    try {
      const url = baseUrl + rel + '?v=' + (cfg.fileVersion || 0);
      let audio = cache[url];
      if (!audio) { audio = new Audio(url); cache[url] = audio; }
      audio.pause();
      audio.currentTime = 0;
      audio.volume = vol();
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) { return false; }
  }

  const S = {
    configure(next, dataUrl) {
      cfg = { ...cfg, ...next };
      if (dataUrl !== undefined) baseUrl = dataUrl;
    },
    unlock() { ac(); },
    // 加分：清脆的兩聲上揚
    plus(big) {
      if (!cfg.on) return;
      if (cfg.plus && playFile(cfg.plus)) return;
      tone(988, 0, 0.12, 'triangle', 0.3);
      tone(1319, 0.08, 0.22, 'triangle', 0.3);
      if (big) tone(1760, 0.16, 0.25, 'sine', 0.2);
    },
    // 扣分：輕柔、低沉的一聲，不刺耳
    minus() {
      if (!cfg.on) return;
      if (cfg.minus && playFile(cfg.minus)) return;
      tone(392, 0, 0.22, 'sine', 0.22, 294);
    },
    // 抽獎轉動時的滴答聲
    tick() {
      if (!cfg.on) return;
      tone(1800 + Math.random() * 300, 0, 0.03, 'square', 0.05);
    },
    // 抽中：上行琶音
    win() {
      if (!cfg.on) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, 'triangle', 0.28));
      tone(1568, 0.38, 0.4, 'sine', 0.18);
    },
    // 沒加碼：溫和的「噗」
    zero() {
      if (!cfg.on) return;
      tone(523, 0, 0.16, 'sine', 0.2);
      tone(440, 0.12, 0.25, 'sine', 0.18);
    },
    // 扭蛋把手、骰子落地等小聲響
    clunk() {
      if (!cfg.on) return;
      tone(160, 0, 0.12, 'square', 0.12, 90);
    },
    // 兌換獎勵：小號角
    fanfare() {
      if (!cfg.on) return;
      [[523, 0], [523, 0.12], [523, 0.24], [784, 0.36]].forEach(([f, t]) => tone(f, t, 0.14, 'sawtooth', 0.12));
      tone(1047, 0.52, 0.5, 'triangle', 0.25);
      tone(1319, 0.52, 0.5, 'triangle', 0.18);
    },
    ticket() {
      if (!cfg.on) return;
      tone(1175, 0, 0.1, 'triangle', 0.25);
      tone(1568, 0.07, 0.18, 'triangle', 0.25);
    },
    // 緊張的鼓聲：越來越快、音越來越高，回傳一個停止的函式
    suspense(ms = 3000) {
      if (!cfg.on) return () => {};
      const a = ac();
      if (!a) return () => {};
      const start = a.currentTime;
      const end = start + ms / 1000;
      const nodes = [];
      let t = start, gap = 0.16;
      while (t < end) {
        const p = (t - start) / (ms / 1000);
        const src = a.createBufferSource();
        src.buffer = noiseBuf(a);
        const f = a.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 180 + p * 260; f.Q.value = 1.2;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime((0.25 + p * 0.45) * vol(), t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        src.connect(f).connect(g).connect(a.destination);
        src.start(t); src.stop(t + 0.1);
        nodes.push(src);
        t += gap; gap = Math.max(0.045, gap * 0.94);
      }
      // 背景慢慢升高的音
      const o = a.createOscillator(), og = a.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, start);
      o.frequency.exponentialRampToValueAtTime(330, end);
      og.gain.setValueAtTime(0.0001, start);
      og.gain.exponentialRampToValueAtTime(0.035 * vol() + 0.0001, end);
      o.connect(og).connect(a.destination);
      o.start(start); o.stop(end + 0.05);
      nodes.push(o);
      return () => { nodes.forEach((n) => { try { n.stop(); } catch (e) { /* 已經停了 */ } }); };
    },
    // 日本抽獎機裡面球碰撞的喀啦聲
    rattle() {
      if (!cfg.on) return;
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) tone(900 + Math.random() * 900, i * 0.03, 0.035, 'square', 0.06);
    },
    // 中獎的手搖鈴：噹啷噹啷
    bell() {
      if (!cfg.on) return;
      for (let i = 0; i < 9; i++) {
        const t = i * 0.13;
        [1, 2.76, 5.4].forEach((r, k) => tone(1180 * r * (i % 2 ? 1.02 : 1), t, 0.5 - k * 0.12, 'sine', 0.16 / (k + 1)));
      }
    },
    // 拉霸：拉桿
    lever() {
      if (!cfg.on) return;
      tone(220, 0, 0.12, 'square', 0.1, 120);
      tone(600, 0.1, 0.18, 'triangle', 0.12, 900);
    },
    // 拉霸：一個轉輪停下
    reelStop() {
      if (!cfg.on) return;
      tone(140, 0, 0.1, 'square', 0.14, 80);
      tone(1400, 0, 0.04, 'square', 0.05);
    },
    // 拉霸中獎：叮叮叮的硬幣聲
    coins() {
      if (!cfg.on) return;
      for (let i = 0; i < 14; i++) tone(1800 + Math.random() * 900, i * 0.06, 0.12, 'triangle', 0.14);
    },
    test(kind) {
      const was = cfg.on;
      cfg.on = true;
      S[kind]();
      cfg.on = was;
    }
  };
  return S;
})();
