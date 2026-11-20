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
    test(kind) {
      const was = cfg.on;
      cfg.on = true;
      S[kind]();
      cfg.on = was;
    }
  };
  return S;
})();
