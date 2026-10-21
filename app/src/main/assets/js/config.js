/* تنظیمات متمرکز بازی «جاسوس | SPY» — امتیازها و محدودیت‌ها فقط همین‌جا تعریف می‌شوند. */
if (typeof globalThis === 'undefined') { window.globalThis = window; } // سازگاری با وب‌ویوهای قدیمی
(function () {
  'use strict';
  const SPY = (globalThis.SPY = globalThis.SPY || {});

  SPY.CONFIG = {
    APP_NAME: 'جاسوس | SPY',
    VERSION: '1.0.0',
    STORAGE_PREFIX: 'spy.v1.',

    LIMITS: {
      minPlayers: 3,
      maxPlayers: 20,
      minRounds: 1,
      maxRounds: 10,
      maxNameLength: 16,
      maxTieRevotes: 1, // تعداد دفعات مجاز رأی‌گیری مجدد پس از مساوی شدن
    },

    TIME_OPTIONS: [1, 2, 3, 5, 10],
    GUESS_OPTION_COUNT: 12, // تعداد گزینه‌های پیشنهادی در مرحله حدس جاسوس

    DEFAULT_SETTINGS: {
      playerCount: 5,
      spyCount: 1,
      rounds: 3,
      timeMinutes: 5,
      spyGuess: true,
      showGuide: true,
      mixRandom: false,
      tieRule: 'revote', // 'revote' | 'spies'
      timeoutRule: 'vote', // 'vote' | 'spies'
      categories: ['places', 'animals', 'persian-food', 'jobs', 'fruits'],
      names: [],
    },

    DEFAULT_GENERAL: {
      sound: true,
      vibration: true,
      keepAwake: true,
    },

    // امتیازهای پیش‌فرض (در «تنظیمات» قابل تغییرند)
    DEFAULT_SCORING: {
      normalWinCatch: 2, // هر بازیکن عادی، وقتی جاسوس لو می‌رود و درست حدس نمی‌زند
      spyEscape: 3, // هر جاسوس، وقتی شناسایی نمی‌شود
      spyGuessCorrect: 4, // هر جاسوس، وقتی کلمه را درست حدس می‌زند
      correctVoteBonus: 1, // هر بازیکن عادی که به یک جاسوس واقعی رأی داده است
    },
    SCORING_RANGE: { min: 0, max: 10 },
  };
})();
