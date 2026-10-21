/* پل ارتباطی با کد Kotlin (SpyNative). خارج از اندروید همه توابع بی‌اثرند. */
(function () {
  'use strict';
  const SPY = (globalThis.SPY = globalThis.SPY || {});
  const bridge = () => (typeof window !== 'undefined' && window.SpyNative) || null;
  const safe = (fn) => { try { fn(); } catch (e) { /* نادیده */ } };

  SPY.Native = {
    available: () => !!bridge(),
    secure(on) { safe(() => bridge() && bridge().setSecure(!!on)); },
    keepAwake(on) { safe(() => bridge() && bridge().keepScreenOn(!!on)); },
    vibrate(ms) {
      safe(() => {
        if (bridge()) bridge().vibrate(ms | 0);
        else if (navigator.vibrate) navigator.vibrate(ms);
      });
    },
    exit() { safe(() => bridge() && bridge().exitApp()); },
  };
})();
