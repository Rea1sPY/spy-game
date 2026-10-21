/* افکت‌های صوتی ساده با WebAudio (بدون فایل صوتی) + لرزش. با تنظیمات قابل خاموش شدن است. */
(function () {
  'use strict';
  const SPY = (globalThis.SPY = globalThis.SPY || {});
  let ctx = null;

  function getCtx() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, start, dur, type, vol) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    click() { tone(620, 0, 0.05, 'sine', 0.04); },
    tick() { tone(900, 0, 0.06, 'square', 0.03); },
    reveal() { tone(440, 0, 0.08, 'sine', 0.06); tone(660, 0.08, 0.12, 'sine', 0.06); },
    success() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.11, 0.18, 'triangle', 0.08)); },
    fail() { tone(330, 0, 0.18, 'sawtooth', 0.05); tone(220, 0.16, 0.28, 'sawtooth', 0.05); },
    alarm() { [0, 0.3, 0.6].forEach((s) => tone(880, s, 0.2, 'square', 0.06)); },
  };

  SPY.Audio = {
    soundOn: true,
    vibrationOn: true,
    play(name) {
      if (!this.soundOn || !SOUNDS[name]) return;
      try {
        const c = getCtx();
        if (c && c.state === 'suspended') c.resume();
        SOUNDS[name]();
      } catch (e) { /* نادیده */ }
    },
    buzz(ms) { if (this.vibrationOn && SPY.Native) SPY.Native.vibrate(ms || 400); },
  };
})();
