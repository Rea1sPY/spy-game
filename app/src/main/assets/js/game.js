/* منطق خالص بازی (بدون DOM) — در Node هم قابل تست است. */
(function () {
  'use strict';
  const SPY = (globalThis.SPY = globalThis.SPY || {});
  const L = SPY.CONFIG.LIMITS;
  const G = (SPY.Game = {});

  /* ---------- ابزارهای عمومی ---------- */
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  G.fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);

  G.makeRng = function () {
    const c = globalThis.crypto;
    if (c && c.getRandomValues) {
      const buf = new Uint32Array(1);
      return () => { c.getRandomValues(buf); return buf[0] / 4294967296; };
    }
    return Math.random;
  };
  G.rng = G.makeRng();
  G.randInt = (n, rng) => Math.floor((rng || G.rng)() * n);
  G.shuffle = function (arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = G.randInt(i + 1, rng);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  G.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- نرمال‌سازی و مقایسه حدس ---------- */
  const MAP = { 'ي': 'ی', 'ى': 'ی', 'ئ': 'ی', 'ك': 'ک', 'ۀ': 'ه', 'ة': 'ه', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا', 'آ': 'ا', 'ؤ': 'و' };
  G.normalize = function (s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) { /* نادیده */ }
    s = s.replace(/[يىئكۀةأإٱآؤ]/g, (ch) => MAP[ch]);
    s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
    s = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    s = s.toLowerCase();
    return s.replace(/[^\p{L}\p{N}]/gu, ''); // فاصله، نیم‌فاصله و علائم نگارشی حذف می‌شوند
  };

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /** حدس درست است اگر پس از نرمال‌سازی برابر باشد (یا برای کلمه‌های بلند، فقط یک حرف اختلاف داشته باشد). */
  G.guessMatches = function (guess, secret) {
    const a = G.normalize(guess), b = G.normalize(secret);
    if (!a || !b) return false;
    if (a === b) return true;
    return b.length >= 7 && Math.abs(a.length - b.length) <= 1 && lev(a, b) <= 1;
  };

  /* ---------- اعتبارسنجی تنظیمات ---------- */
  G.maxSpies = (players) => Math.max(1, Math.floor((players - 1) / 2));

  G.validateSetup = function (s, bank) {
    const errs = [];
    if (!Number.isInteger(s.playerCount) || s.playerCount < L.minPlayers || s.playerCount > L.maxPlayers) {
      errs.push(`تعداد بازیکنان باید بین ${G.fa(L.minPlayers)} و ${G.fa(L.maxPlayers)} نفر باشد.`);
    } else {
      const max = G.maxSpies(s.playerCount);
      if (!Number.isInteger(s.spyCount) || s.spyCount < 1) errs.push('حداقل یک جاسوس لازم است.');
      else if (s.spyCount > max) errs.push(`برای ${G.fa(s.playerCount)} بازیکن حداکثر ${G.fa(max)} جاسوس مجاز است.`);
    }
    if (!Number.isInteger(s.rounds) || s.rounds < L.minRounds || s.rounds > L.maxRounds) {
      errs.push(`تعداد دورها باید بین ${G.fa(L.minRounds)} و ${G.fa(L.maxRounds)} باشد.`);
    }
    if (!SPY.CONFIG.TIME_OPTIONS.includes(s.timeMinutes)) errs.push('زمان هر دور نامعتبر است.');
    const ids = (s.categories || []).filter((id) => bank.some((c) => c.id === id && c.words.length));
    if (!ids.length) errs.push('حداقل یک دسته‌بندی را انتخاب کنید.');
    return errs;
  };

  /** نام‌ها را پاک‌سازی می‌کند. خروجی: { names, error } */
  G.cleanNames = function (raw, count) {
    const names = [];
    const seen = new Set();
    for (let i = 0; i < count; i++) {
      let n = String((raw && raw[i]) || '').replace(/\s+/g, ' ').trim().slice(0, L.maxNameLength);
      if (!n) n = `بازیکن ${G.fa(i + 1)}`;
      const key = G.normalize(n);
      if (seen.has(key)) return { names, error: `نام «${n}» تکراری است. برای هر بازیکن نام متفاوتی بنویسید.` };
      seen.add(key);
      names.push(n);
    }
    return { names, error: '' };
  };

  /* ---------- انتخاب کلمه ---------- */
  G.pickWord = function (opts) {
    const { catIds, bank, used, mixRandom, rng } = opts;
    const cats = bank.filter((c) => catIds.includes(c.id) && c.words.length);
    if (!cats.length) return null;
    const free = (c) => c.words.filter((w) => !used.has(w));
    let avail = cats.filter((c) => free(c).length);
    if (!avail.length) { // همه کلمه‌ها استفاده شده‌اند؛ چرخه از نو
      cats.forEach((c) => c.words.forEach((w) => used.delete(w)));
      avail = cats;
    }
    let word, cat;
    if (mixRandom) {
      cat = avail[G.randInt(avail.length, rng)];
      const f = free(cat);
      word = f[G.randInt(f.length, rng)];
    } else {
      const flat = [];
      avail.forEach((c) => free(c).forEach((w) => flat.push({ w, c })));
      const x = flat[G.randInt(flat.length, rng)];
      word = x.w; cat = x.c;
    }
    used.add(word);
    return { word, catId: cat.id };
  };

  G.guessOptions = function (opts) {
    const { word, bank, catIds, count, rng } = opts;
    const pool = [];
    bank.filter((c) => catIds.includes(c.id)).forEach((c) => c.words.forEach((w) => { if (w !== word) pool.push(w); }));
    const others = G.shuffle(pool, rng).slice(0, Math.max(0, count - 1));
    return G.shuffle(others.concat([word]), rng);
  };

  /* ---------- ساخت دور ---------- */
  G.createRound = function (opts) {
    const { players, spyCount, word, catId, rng } = opts;
    const ids = players.map((p) => p.id);
    const spyIds = G.shuffle(ids, rng).slice(0, spyCount);
    const starterId = ids[G.randInt(ids.length, rng)];
    return { word, catId, spyIds, starterId };
  };

  /* ---------- رأی‌گیری ---------- */
  G.tally = function (votes, candidates) {
    const counts = {};
    candidates.forEach((id) => { counts[id] = 0; });
    Object.keys(votes).forEach((voter) => {
      const t = votes[voter];
      if (Object.prototype.hasOwnProperty.call(counts, t) && t !== voter) counts[t]++;
    });
    let max = 0;
    candidates.forEach((id) => { if (counts[id] > max) max = counts[id]; });
    const leaders = candidates.filter((id) => counts[id] === max);
    return { counts, max, leaders };
  };

  G.resolveVote = function (t, settings, tieCount) {
    if (t.leaders.length === 1) return { status: 'accused', accusedId: t.leaders[0] };
    if (settings.tieRule === 'revote' && tieCount < L.maxTieRevotes) return { status: 'revote', tied: t.leaders };
    return { status: 'tie-final', tied: t.leaders };
  };

  /* ---------- امتیازدهی ---------- */
  // outcome: spy-caught | spy-guessed | spy-escaped | tie-escape | timeout-escape | aborted
  G.scoreRound = function (opts) {
    const { players, spyIds, outcome, votes, scoring } = opts;
    const deltas = {};
    players.forEach((p) => { deltas[p.id] = 0; });
    const isSpy = (id) => spyIds.includes(id);
    let side = 'none';
    if (outcome === 'aborted') return { deltas, side };

    if (outcome === 'spy-caught') {
      side = 'normal';
      players.forEach((p) => { if (!isSpy(p.id)) deltas[p.id] += scoring.normalWinCatch; });
    } else {
      side = 'spy';
      const pts = outcome === 'spy-guessed' ? scoring.spyGuessCorrect : scoring.spyEscape;
      players.forEach((p) => { if (isSpy(p.id)) deltas[p.id] += pts; });
    }
    if (outcome !== 'timeout-escape') {
      Object.keys(votes || {}).forEach((voter) => {
        if (!isSpy(voter) && isSpy(votes[voter]) && deltas[voter] !== undefined) deltas[voter] += scoring.correctVoteBonus;
      });
    }
    return { deltas, side };
  };

  G.rank = function (players, totals) {
    const rows = players.map((p) => ({ id: p.id, name: p.name, points: totals[p.id] || 0 }));
    rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'fa'));
    let rank = 0, last = null;
    rows.forEach((r, i) => { if (r.points !== last) { rank = i + 1; last = r.points; } r.rank = rank; });
    return rows;
  };

  G.winners = function (players, totals) {
    const rows = G.rank(players, totals);
    if (!rows.length || rows[0].points <= 0) return [];
    return rows.filter((r) => r.points === rows[0].points);
  };

  /* ---------- آمار و رکوردها (فقط نام و امتیاز؛ بدون کلمه و نقش) ---------- */
  G.emptyStats = () => ({ games: 0, rounds: 0, spyWins: 0, normalWins: 0, players: [] });

  function entry(stats, name) {
    let e = stats.players.find((p) => p.name === name);
    if (!e) {
      e = { name, games: 0, wins: 0, points: 0, rounds: 0, spyRounds: 0, spyWins: 0 };
      stats.players.push(e);
    }
    return e;
  }

  G.recordRound = function (stats, info) {
    const { players, spyIds, deltas, side, outcome } = info;
    if (outcome === 'aborted') return stats;
    stats.rounds++;
    if (side === 'spy') stats.spyWins++; else stats.normalWins++;
    players.forEach((p) => {
      const e = entry(stats, p.name);
      e.rounds++;
      e.points += deltas[p.id] || 0;
      if (spyIds.includes(p.id)) { e.spyRounds++; if (side === 'spy') e.spyWins++; }
    });
    return stats;
  };

  G.recordGame = function (stats, info) {
    const { players, totals } = info;
    stats.games++;
    const win = G.winners(players, totals).map((w) => w.id);
    players.forEach((p) => {
      const e = entry(stats, p.name);
      e.games++;
      if (win.includes(p.id)) e.wins++;
    });
    return stats;
  };
})();
