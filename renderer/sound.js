// 音效：全部用程式即時合成（沒有版權問題），加分、扣分也可以換成老師自己的音檔
// 第四版：加上殘響、多層音色；新增等待專屬音效、點擊回饋、小獎／大獎專屬音效、刮刮樂音效
window.Sound = (() => {
  'use strict';
  let ctx = null, master = null, revSend = null;
  let cfg = { on: true, volume: 70, plus: null, minus: null };
  let baseUrl = '';
  const cache = {};

  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        // 主音量 → 壓縮（避免爆音）→ 喇叭；另外一路送到殘響，聽起來比較飽滿
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        master = ctx.createGain();
        master.connect(comp).connect(ctx.destination);
        const conv = ctx.createConvolver();
        conv.buffer = impulse(ctx, 2.2);
        revSend = ctx.createGain();
        revSend.gain.value = 0.9;
        revSend.connect(conv).connect(master);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (master) master.gain.value = vol();
    return ctx;
  }
  const vol = () => Math.max(0, Math.min(1, (Number(cfg.volume) || 0) / 100));

  function impulse(a, sec) {
    const len = Math.floor(a.sampleRate * sec);
    const b = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }
  let noise = null;
  function noiseBuf(a) {
    if (noise) return noise;
    noise = a.createBuffer(1, a.sampleRate * 1, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }

  // 輸出：直接聲＋殘響
  function out(node, rev, bus) {
    node.connect(bus || master);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s).connect(revSend); }
  }

  // 一個音符
  function tone(freq, start, dur, type = 'triangle', gain = 0.25, slideTo = null, rev = 0.15, bus = null) {
    const a = ac(); if (!a) return;
    const t0 = a.currentTime + start;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); out(g, rev, bus);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  // 鐘聲／鐵琴：幾個泛音疊在一起
  function chime(freq, start, dur = 0.8, gain = 0.2, rev = 0.35) {
    [[1, 1], [2.0, 0.45], [3.0, 0.22], [4.16, 0.12]].forEach(([r, k]) => tone(freq * r, start, dur / (1 + (r - 1) * 0.6), 'sine', gain * k, null, rev));
  }
  // 噪音：鼓、刮、沙沙聲
  function noiseHit(start, dur, f0, f1, type = 'bandpass', gain = 0.3, q = 1, rev = 0.1, bus = null) {
    const a = ac(); if (!a) return;
    const t0 = a.currentTime + start;
    const src = a.createBufferSource();
    src.buffer = noiseBuf(a);
    src.loopStart = Math.random() * 0.5;
    const f = a.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g); out(g, rev, bus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
    return src;
  }
  // 銅管：兩個稍微走音的鋸齒波加上會打開的濾波器
  function brass(freq, start, dur, gain = 0.12, rev = 0.3) {
    const a = ac(); if (!a) return;
    const t0 = a.currentTime + start;
    const f = a.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(500, t0);
    f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.06);
    f.frequency.exponentialRampToValueAtTime(1600, t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04);
    g.gain.setValueAtTime(gain * 0.8, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    [-7, 7].forEach((cents) => {
      const o = a.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = cents;
      o.connect(f); o.start(t0); o.stop(t0 + dur + 0.05);
    });
    f.connect(g); out(g, rev);
  }
  // 大鼓
  function boom(start, gain = 0.5) {
    tone(120, start, 0.45, 'sine', gain, 45, 0.2);
    noiseHit(start, 0.12, 900, 200, 'lowpass', gain * 0.5, 0.7, 0.2);
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

  const on = () => cfg.on && ac();

  const S = {
    configure(next, dataUrl) {
      cfg = { ...cfg, ...next };
      if (dataUrl !== undefined) baseUrl = dataUrl;
      if (master) master.gain.value = vol();
    },
    unlock() { ac(); },

    // ---------- 加減分 ----------
    plus() {
      if (!cfg.on) return;
      if (cfg.plus && playFile(cfg.plus)) return;
      if (!on()) return;
      chime(1319, 0, 0.6, 0.22); chime(1760, 0.07, 0.8, 0.2);
      tone(2637, 0.12, 0.3, 'sine', 0.05, null, 0.5);
    },
    minus() {
      if (!cfg.on) return;
      if (cfg.minus && playFile(cfg.minus)) return;
      if (!on()) return;
      tone(392, 0, 0.26, 'sine', 0.2, 294, 0.1);
      tone(196, 0, 0.2, 'sine', 0.08, 147, 0);
    },
    ticket() { if (!on()) return; chime(1175, 0, 0.5, 0.2); chime(1568, 0.08, 0.7, 0.2); },

    // ---------- 機器的小聲響 ----------
    tick() { if (!on()) return; noiseHit(0, 0.025, 4500, null, 'highpass', 0.12, 0.7, 0.05); tone(2200, 0, 0.02, 'square', 0.025, null, 0); },
    clunk() { if (!on()) return; tone(150, 0, 0.16, 'sine', 0.3, 60, 0.1); noiseHit(0, 0.06, 1200, 300, 'lowpass', 0.15, 0.7, 0.05); },
    rattle() {
      if (!on()) return;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) noiseHit(i * 0.035, 0.03, 1800 + Math.random() * 1600, null, 'bandpass', 0.18, 6, 0.08);
    },
    bell() {
      if (!on()) return;
      for (let i = 0; i < 10; i++) chime(1180 * (i % 2 ? 1.03 : 1), i * 0.12, 0.7, 0.13, 0.4);
    },
    lever() {
      if (!on()) return;
      for (let i = 0; i < 5; i++) noiseHit(i * 0.025, 0.02, 3000, null, 'bandpass', 0.15, 4, 0);
      tone(220, 0.12, 0.2, 'sine', 0.2, 110, 0.1);
      tone(700, 0.2, 0.25, 'triangle', 0.08, 1100, 0.2);
    },
    reelStop() { if (!on()) return; tone(130, 0, 0.14, 'sine', 0.35, 70, 0.15); noiseHit(0, 0.04, 2500, null, 'bandpass', 0.2, 3, 0.1); },
    whoosh() { if (!on()) return; noiseHit(0, 0.45, 300, 3000, 'bandpass', 0.18, 1.5, 0.3); },

    // ---------- 等待專屬音效：鼓聲越來越快＋心跳＋往上升的聲音 ----------
    suspense(ms = 3000) {
      if (!on()) return () => {};
      const a = ctx;
      const bus = a.createGain();
      bus.gain.value = 1;
      bus.connect(master);
      const sec = ms / 1000, start = a.currentTime;
      const srcs = [];
      // 小鼓滾奏
      let t = 0, gap = 0.17;
      while (t < sec) {
        const p = t / sec;
        srcs.push(noiseHit(t, 0.07, 1400 + p * 1600, null, 'bandpass', 0.07 + p * 0.16, 1.1, 0.12, bus));
        t += gap; gap = Math.max(0.04, gap * 0.95);
      }
      // 心跳低音鼓
      for (let h = 0; h < sec - 0.2; h += Math.max(0.32, 0.62 - h / sec * 0.3)) {
        srcs.push(tone(62, h, 0.22, 'sine', 0.32, 40, 0, bus));
        srcs.push(tone(62, h + 0.16, 0.18, 'sine', 0.22, 40, 0, bus));
      }
      // 往上升的聲音
      const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(98, start);
      o.frequency.exponentialRampToValueAtTime(392, start + sec);
      f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(300, start);
      f.frequency.exponentialRampToValueAtTime(3000, start + sec);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.07, start + sec);
      o.connect(f).connect(g); g.connect(bus);
      const s2 = a.createGain(); s2.gain.value = 0.3; g.connect(s2).connect(revSend);
      o.start(start); o.stop(start + sec + 0.1);
      srcs.push(o);
      return () => {
        try {
          bus.gain.setTargetAtTime(0.0001, a.currentTime, 0.05);
          g.gain.cancelScheduledValues(a.currentTime);
          g.gain.setTargetAtTime(0.0001, a.currentTime, 0.05);
        } catch (e) { /* ignore */ }
        setTimeout(() => srcs.forEach((n) => { try { n && n.stop(); } catch (e) { /* 已經停了 */ } }), 300);
      };
    },

    // ---------- 點擊回饋：每點一下「啵」一聲，能量越高音越高 ----------
    tap(level = 0) {
      if (!on()) return;
      const f = 520 + level * 900 + Math.random() * 60;
      tone(f, 0, 0.09, 'sine', 0.22, f * 0.55, 0.15);
      noiseHit(0, 0.02, 5000, null, 'highpass', 0.06, 0.7, 0);
    },
    // 能量條集滿：加油！
    cheer() {
      if (!on()) return;
      noiseHit(0, 0.35, 400, 4000, 'bandpass', 0.15, 1.2, 0.3);
      [523, 659, 784].forEach((fr) => brass(fr, 0.15, 0.35, 0.06, 0.3));
      [1568, 2093, 2637].forEach((fr, i) => chime(fr, 0.2 + i * 0.05, 0.4, 0.08));
    },
    sparkle() { if (!on()) return; for (let i = 0; i < 5; i++) chime(2000 + Math.random() * 1800, i * 0.05, 0.35, 0.06, 0.5); },

    // ---------- 結果 ----------
    // 小獎：明亮的琶音＋和弦
    win() {
      if (!on()) return;
      boom(0, 0.3);
      [523, 659, 784, 1047, 1319].forEach((fr, i) => chime(fr, i * 0.08, 0.9, 0.17));
      [523, 659, 784].forEach((fr) => brass(fr, 0.42, 0.7, 0.05));
      for (let i = 0; i < 6; i++) chime(2400 + Math.random() * 1500, 0.5 + i * 0.07, 0.4, 0.05, 0.6);
    },
    // 大獎：大鼓＋號角旋律＋長和弦＋金幣雨
    jackpot() {
      if (!on()) return;
      boom(0, 0.55); boom(0.32, 0.4);
      const mel = [[392, 0], [523, 0.16], [659, 0.32], [784, 0.48], [659, 0.68], [784, 0.8]];
      mel.forEach(([fr, t]) => brass(fr, t, t === 0.8 ? 1.4 : 0.2, 0.11));
      [523, 659, 784, 1047].forEach((fr) => brass(fr, 0.8, 1.6, 0.05));
      boom(0.8, 0.5);
      for (let i = 0; i < 26; i++) chime(1800 + Math.random() * 2000, 0.9 + i * 0.055, 0.45, 0.06, 0.5);
      tone(523, 0.8, 2.2, 'sine', 0.06, 1047, 0.6);
    },
    // 沒中：溫和的木琴兩聲，不刺耳
    zero() {
      if (!on()) return;
      tone(659, 0, 0.3, 'sine', 0.18, null, 0.2);
      tone(523, 0.16, 0.45, 'sine', 0.16, null, 0.25);
    },
    // 兌換獎勵
    fanfare() {
      if (!on()) return;
      boom(0, 0.35);
      [[523, 0], [523, 0.12], [523, 0.24], [784, 0.38]].forEach(([fr, t]) => brass(fr, t, t > 0.3 ? 0.9 : 0.12, 0.1));
      [1047, 1319, 1568].forEach((fr, i) => chime(fr, 0.42 + i * 0.06, 1, 0.12));
    },
    coins() { if (!on()) return; for (let i = 0; i < 16; i++) chime(1900 + Math.random() * 1300, i * 0.055, 0.35, 0.09, 0.4); },

    // ---------- 賽跑音樂：緊張的奔馳節奏，越跑越快 ----------
    raceMusic(sec = 8) {
      if (!on()) return () => {};
      const a = ctx, start = a.currentTime;
      const bus = a.createGain(); bus.gain.value = 0.9; bus.connect(master);
      const srcs = [];
      const push = (n) => { if (n) srcs.push(n); };
      // A 小調：Am → F → G → E（每小節 4 拍）
      const CH = [
        { b: 110, n: [440, 523.25, 659.25] },
        { b: 87.31, n: [349.23, 440, 523.25] },
        { b: 98, n: [392, 493.88, 587.33] },
        { b: 82.41, n: [329.63, 415.3, 493.88] }
      ];
      // 速度從 150 慢慢加到 200 BPM
      let t = 0, beat = 0;
      while (t < sec) {
        const p = t / sec, bpm = 150 + p * 50, q = 60 / bpm, s16 = q / 4;
        const ch = CH[Math.floor(beat / 4) % 4];
        // 馬蹄聲：噠噠「咚」
        push(noiseHit(t, 0.05, 700, null, 'bandpass', 0.10, 1.2, 0.03, bus));
        push(noiseHit(t + s16, 0.05, 900, null, 'bandpass', 0.09, 1.2, 0.03, bus));
        push(tone(95, t + s16 * 2, 0.14, 'sine', 0.34, 50, 0, bus));
        push(noiseHit(t + s16 * 2, 0.07, 500, 200, 'lowpass', 0.16, 0.8, 0.03, bus));
        // 小鈸
        for (let k = 0; k < 4; k++) push(noiseHit(t + s16 * k, 0.03, 8000, null, 'highpass', k === 2 ? 0.05 : 0.025, 0.7, 0, bus));
        // 低音：八分音符
        [0, 2].forEach((k, i) => push(tone(i ? ch.b * 1.5 : ch.b, t + s16 * k, s16 * 1.8, 'sawtooth', 0.09, null, 0.05, bus)));
        // 琶音：十六分音符上上下下，後半段高八度
        const oct = p > 0.55 ? 2 : 1;
        for (let k = 0; k < 4; k++) {
          const idx = [0, 1, 2, 1][(beat * 4 + k) % 4];
          push(tone(ch.n[idx] * oct, t + s16 * k, s16 * 0.9, 'square', 0.035 + p * 0.02, null, 0.12, bus));
        }
        // 每小節第一拍：弦樂重音
        if (beat % 4 === 0) ch.n.forEach((f) => push(tone(f / 2, t, q * 1.6, 'sawtooth', 0.05, null, 0.3, bus)));
        t += q; beat++;
      }
      // 最後衝刺：往上升
      const o = a.createOscillator(), f = a.createBiquadFilter(), gg = a.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(220, start + sec * 0.6); o.frequency.exponentialRampToValueAtTime(880, start + sec);
      f.type = 'lowpass'; f.frequency.value = 2500;
      gg.gain.setValueAtTime(0.0001, start); gg.gain.setValueAtTime(0.0001, start + sec * 0.6); gg.gain.exponentialRampToValueAtTime(0.06, start + sec);
      o.connect(f).connect(gg).connect(bus); o.start(start); o.stop(start + sec + 0.1); srcs.push(o);
      return () => {
        try { bus.gain.setTargetAtTime(0.0001, a.currentTime, 0.08); } catch (e) { /* ignore */ }
        setTimeout(() => srcs.forEach((n) => { try { n.stop(); } catch (e) { /* 已經停了 */ } }), 400);
      };
    },
    // ---------- 賽車背景音樂：一直循環，最後一圈變快 ----------
    loopMusic() {
      if (!on()) return { stop() {}, fast() {} };
      const a = ctx;
      const bus = a.createGain(); bus.gain.value = 0.75; bus.connect(master);
      const CH = [
        { b: 110, n: [440, 523.25, 659.25] }, { b: 87.31, n: [349.23, 440, 523.25] },
        { b: 130.81, n: [392, 523.25, 659.25] }, { b: 98, n: [392, 493.88, 587.33] }
      ];
      const LEAD = [659.25, 0, 783.99, 659.25, 587.33, 0, 523.25, 587.33, 659.25, 0, 880, 783.99, 659.25, 587.33, 523.25, 0];
      let bpm = 160, next = a.currentTime + 0.08, beat = 0;
      const sched = () => {
        while (next < a.currentTime + 0.35) {
          const t = next - a.currentTime, q = 60 / bpm, s16 = q / 4, ch = CH[Math.floor(beat / 4) % 4];
          noiseHit(t, 0.05, 700, null, 'bandpass', 0.08, 1.2, 0.03, bus);
          noiseHit(t + s16, 0.05, 900, null, 'bandpass', 0.07, 1.2, 0.03, bus);
          tone(95, t + s16 * 2, 0.14, 'sine', 0.3, 50, 0, bus);
          for (let k = 0; k < 4; k++) noiseHit(t + s16 * k, 0.03, 8000, null, 'highpass', k === 2 ? 0.045 : 0.02, 0.7, 0, bus);
          [0, 2].forEach((k, i) => tone(i ? ch.b * 1.5 : ch.b, t + s16 * k, s16 * 1.8, 'sawtooth', 0.08, null, 0.05, bus));
          for (let k = 0; k < 4; k++) tone(ch.n[[0, 1, 2, 1][k]] * (bpm > 175 ? 2 : 1), t + s16 * k, s16 * 0.9, 'square', 0.025, null, 0.12, bus);
          if ((Math.floor(beat / 16) % 2) === 1) { const f = LEAD[(beat * 2) % 16], f2 = LEAD[(beat * 2 + 1) % 16]; if (f) tone(f, t, q * 0.45, 'triangle', 0.07, null, 0.2, bus); if (f2) tone(f2, t + q / 2, q * 0.45, 'triangle', 0.07, null, 0.2, bus); }
          if (beat % 4 === 0) ch.n.forEach((f) => tone(f / 2, t, q * 1.6, 'sawtooth', 0.035, null, 0.3, bus));
          next += q; beat++;
        }
      };
      sched();
      const timer = setInterval(sched, 90);
      return {
        stop() { clearInterval(timer); try { bus.gain.setTargetAtTime(0.0001, a.currentTime, 0.1); setTimeout(() => bus.disconnect(), 800); } catch (e) { /* ignore */ } },
        fast() { bpm = 190; }
      };
    },
    // ---------- 換到入場券：收銀機＋上升號角＋閃亮亮 ----------
    bigTicket() {
      if (!on()) return;
      boom(0, 0.4);
      noiseHit(0, 0.08, 3500, null, 'bandpass', 0.25, 4, 0.1);         // 喀
      chime(2093, 0.06, 0.9, 0.22); chime(2637, 0.1, 1.1, 0.2);       // 鏘～
      [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => brass(fr, 0.18 + i * 0.08, i === 3 ? 0.7 : 0.14, 0.11));
      for (let i = 0; i < 12; i++) chime(1568 + i * 160, 0.5 + i * 0.035, 0.5, 0.08, 0.45);
      boom(0.42, 0.35);
    },
    // ---------- 彈珠台 ----------
    bumper(n = 0) { if (!on()) return; const f = [660, 740, 880, 990, 1175][n % 5]; tone(f, 0, 0.09, 'square', 0.07, f * 1.5, 0.12); tone(f * 2, 0.02, 0.12, 'sine', 0.06, null, 0.2); },
    flipper() { if (!on()) return; noiseHit(0, 0.05, 900, 300, 'lowpass', 0.25, 1, 0.05); tone(140, 0, 0.08, 'square', 0.1, 90, 0.05); },
    launch() { if (!on()) return; noiseHit(0, 0.25, 400, 2400, 'bandpass', 0.18, 2, 0.1); tone(220, 0, 0.25, 'sawtooth', 0.06, 660, 0.1); },
    // ---------- 刮刮樂 ----------
    scratch() { if (!on()) return; noiseHit(0, 0.06, 2600 + Math.random() * 1500, null, 'bandpass', 0.07, 2.5, 0); },
    reveal(match) {
      if (!on()) return;
      tone(880, 0, 0.12, 'sine', 0.16, 1320, 0.2);
      if (match) chime(match === 3 ? 1760 : 1319, 0.06, 0.6, match === 3 ? 0.2 : 0.12);
    },

    test(kind) {
      const was = cfg.on;
      cfg.on = true;
      const r = S[kind]();
      if (typeof r === 'function') setTimeout(r, 2500);
      cfg.on = was;
    }
  };
  S.winSmall = S.win;
  return S;
})();
