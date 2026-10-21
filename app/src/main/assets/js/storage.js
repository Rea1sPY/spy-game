/* ذخیره‌سازی محلی (localStorage) با پشتیبان حافظه‌ای. کلمه مخفی و نقش‌ها هرگز اینجا ذخیره نمی‌شوند. */
(function () {
  'use strict';
  const SPY = (globalThis.SPY = globalThis.SPY || {});
  const P = SPY.CONFIG.STORAGE_PREFIX;
  const mem = {};
  let ls = null;
  try {
    ls = globalThis.localStorage || null;
    if (ls) { ls.setItem(P + '_t', '1'); ls.removeItem(P + '_t'); }
  } catch (e) { ls = null; }

  SPY.Storage = {
    persistent: !!ls,
    get(key, fallback) {
      try {
        const raw = ls ? ls.getItem(P + key) : mem[key];
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try { if (ls) ls.setItem(P + key, raw); else mem[key] = raw; } catch (e) { mem[key] = raw; }
    },
    remove(key) {
      try { if (ls) ls.removeItem(P + key); } catch (e) { /* نادیده */ }
      delete mem[key];
    },
  };
})();
