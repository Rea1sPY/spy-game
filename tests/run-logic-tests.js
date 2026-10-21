/* تست منطق بازی (Node.js بدون وابستگی):  node tests/run-logic-tests.js */
'use strict';
const assert = require('assert');
const path = require('path');
const A = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'js');
['config', 'words', 'game'].forEach((f) => require(path.join(A, f + '.js')));
const { CONFIG, Game: G, WORD_BANK: BANK } = globalThis.SPY;
const L = CONFIG.LIMITS;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'بازیکن ' + (i + 1) }));
const baseSetup = (o) => Object.assign({}, CONFIG.DEFAULT_SETTINGS, o);
// تولیدکننده تصادفی قطعی برای تکرارپذیری
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

console.log('بانک کلمات');
test('حداقل ۱۰۰۰ کلمه', () => assert(BANK.reduce((a, c) => a + c.words.length, 0) >= 1000));
test('۴۹ دسته با شناسه یکتا', () => { assert.strictEqual(BANK.length, 49); assert.strictEqual(new Set(BANK.map((c) => c.id)).size, 49); });
test('هر دسته حداقل ۱۲ کلمه دارد (برای گزینه‌های حدس)', () => BANK.forEach((c) => assert(c.words.length >= 12, c.id)));
test('هیچ کلمه تکراری (حتی بین دسته‌ها) وجود ندارد', () => {
  const seen = new Set();
  BANK.forEach((c) => c.words.forEach((w) => { const k = G.normalize(w); assert(!seen.has(k), 'تکراری: ' + w); seen.add(k); }));
});
test('کاراکتر عربی (ي ك) و کلمه خالی وجود ندارد', () => BANK.forEach((c) => c.words.forEach((w) => { assert(w.length > 1); assert(!/[يك]/.test(w), w); })));

console.log('اعتبارسنجی تنظیمات');
test('تعداد بازیکن کمتر از ۳ نامعتبر', () => assert(G.validateSetup(baseSetup({ playerCount: 2, spyCount: 1 }), BANK).length > 0));
test('تعداد بازیکن بیشتر از ۲۰ نامعتبر', () => assert(G.validateSetup(baseSetup({ playerCount: 21 }), BANK).length > 0));
test('مرزهای ۳ و ۲۰ معتبرند', () => {
  assert.deepStrictEqual(G.validateSetup(baseSetup({ playerCount: 3, spyCount: 1 }), BANK), []);
  assert.deepStrictEqual(G.validateSetup(baseSetup({ playerCount: 20, spyCount: 9 }), BANK), []);
});
test('تعداد جاسوس بیش از حد مجاز → خطای فارسی', () => {
  const e = G.validateSetup(baseSetup({ playerCount: 5, spyCount: 3 }), BANK);
  assert(e.length === 1 && /حداکثر/.test(e[0]));
});
test('صفر جاسوس نامعتبر است', () => assert(G.validateSetup(baseSetup({ spyCount: 0 }), BANK).length > 0));
test('بدون دسته‌بندی نامعتبر است', () => assert(G.validateSetup(baseSetup({ categories: [] }), BANK).length > 0));
test('maxSpies: ۳→۱، ۵→۲، ۲۰→۹', () => { assert.strictEqual(G.maxSpies(3), 1); assert.strictEqual(G.maxSpies(5), 2); assert.strictEqual(G.maxSpies(20), 9); });
test('نام تکراری رد می‌شود و نام خالی پیش‌فرض می‌گیرد', () => {
  assert(G.cleanNames(['علی', ' علی '], 2).error);
  const r = G.cleanNames(['', 'سارا', ''], 3);
  assert.strictEqual(r.error, ''); assert.strictEqual(r.names[0], 'بازیکن ۱'); assert.strictEqual(r.names[2], 'بازیکن ۳');
});

console.log('انتخاب کلمه و نقش‌ها');
test('کلمه فقط از دسته‌های انتخاب‌شده می‌آید', () => {
  const cat = BANK.find((c) => c.id === 'fruits');
  const used = new Set();
  for (let i = 0; i < 50; i++) { const p = G.pickWord({ catIds: ['fruits'], bank: BANK, used, mixRandom: false }); assert(cat.words.includes(p.word)); assert.strictEqual(p.catId, 'fruits'); }
});
test('تا پایان کلمه‌های دسته، تکراری انتخاب نمی‌شود', () => {
  const cat = BANK.find((c) => c.id === 'jobs'); const used = new Set(); const got = new Set();
  for (let i = 0; i < cat.words.length; i++) got.add(G.pickWord({ catIds: ['jobs'], bank: BANK, used, mixRandom: false }).word);
  assert.strictEqual(got.size, cat.words.length);
});
test('پس از اتمام کلمه‌ها چرخه از نو شروع می‌شود (خطا نمی‌دهد)', () => {
  const used = new Set(); const n = BANK.find((c) => c.id === 'jobs').words.length;
  for (let i = 0; i < n * 2 + 3; i++) assert(G.pickWord({ catIds: ['jobs'], bank: BANK, used, mixRandom: false }).word);
});
test('حالت ترکیب تصادفی از چند دسته انتخاب می‌کند', () => {
  const used = new Set(); const cats = new Set();
  for (let i = 0; i < 60; i++) cats.add(G.pickWord({ catIds: ['fruits', 'animals', 'jobs'], bank: BANK, used, mixRandom: true }).catId);
  assert.strictEqual(cats.size, 3);
});
test('دسته نامعتبر → null', () => assert.strictEqual(G.pickWord({ catIds: ['nope'], bank: BANK, used: new Set() }), null));
test('تعداد جاسوس‌ها دقیق و یکتا است و آغازکننده بازیکن واقعی است', () => {
  for (const [n, s] of [[3, 1], [5, 2], [10, 4], [20, 9]]) {
    for (let k = 0; k < 30; k++) {
      const pl = mkPlayers(n); const r = G.createRound({ players: pl, spyCount: s, word: 'x', catId: 'c' });
      assert.strictEqual(r.spyIds.length, s); assert.strictEqual(new Set(r.spyIds).size, s);
      assert(r.spyIds.every((id) => pl.some((p) => p.id === id))); assert(pl.some((p) => p.id === r.starterId));
    }
  }
});
test('جاسوس بین همه بازیکنان تقریباً یکنواخت توزیع می‌شود', () => {
  const pl = mkPlayers(5); const cnt = {}; const rng = seeded(7);
  for (let i = 0; i < 5000; i++) { const r = G.createRound({ players: pl, spyCount: 1, word: 'x', catId: 'c', rng }); cnt[r.spyIds[0]] = (cnt[r.spyIds[0]] || 0) + 1; }
  Object.values(cnt).forEach((v) => assert(v > 800 && v < 1200, 'توزیع ناهمگون ' + v));
});
test('گزینه‌های حدس شامل کلمه اصلی، بدون تکرار و به تعداد مجاز است', () => {
  const o = G.guessOptions({ word: 'سیب', bank: BANK, catIds: ['fruits', 'animals'], count: 12 });
  assert.strictEqual(o.length, 12); assert(o.includes('سیب')); assert.strictEqual(new Set(o).size, 12);
});

console.log('حدس کلمه');
test('حدس دقیق درست است', () => assert(G.guessMatches('سیب', 'سیب')));
test('فاصله اضافه و نیم‌فاصله نادیده گرفته می‌شود', () => { assert(G.guessMatches('  قورمه سبزی ', 'قورمه‌سبزی')); assert(G.guessMatches('ماشین لباسشویی', 'ماشین  لباس‌شویی')); });
test('ی/ک عربی و ارقام و حروف انگلیسی نرمال می‌شوند', () => { assert(G.guessMatches('كباب كوبيده', 'کباب کوبیده')); assert(G.guessMatches('پژو ٢٠٦', 'پژو ۲۰۶')); });
test('اعراب و کشیده نادیده گرفته می‌شوند', () => assert(G.guessMatches('سِیب', 'سیب')));
test('یک اشتباه تایپی فقط در کلمه‌های بلند پذیرفته می‌شود', () => { assert(G.guessMatches('کتابخانه', 'کتابخانه‌ا'.slice(0, -1)) ); assert(G.guessMatches('ماشین لباسشوی', 'ماشین لباسشویی')); assert(!G.guessMatches('سبب', 'سیب')); });
test('حدس خالی یا اشتباه رد می‌شود', () => { assert(!G.guessMatches('', 'سیب')); assert(!G.guessMatches('   ', 'سیب')); assert(!G.guessMatches('موز', 'سیب')); });

console.log('رأی‌گیری');
const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
test('شمارش آرا و برنده واضح', () => {
  const t = G.tally({ p0: 'p1', p1: 'p2', p2: 'p1', p3: 'p1', p4: 'p0' }, ids);
  assert.deepStrictEqual(t.leaders, ['p1']); assert.strictEqual(t.counts.p1, 3);
  assert.strictEqual(G.resolveVote(t, { tieRule: 'revote' }, 0).status, 'accused');
});
test('رأی به خود نادیده گرفته می‌شود', () => assert.strictEqual(G.tally({ p0: 'p0', p1: 'p2' }, ids).counts.p0, 0));
test('هر رأی‌دهنده فقط یک رأی دارد (ساختار نگاشت)', () => { const v = {}; v.p0 = 'p1'; v.p0 = 'p2'; assert.strictEqual(G.tally(v, ids).counts.p1 + G.tally(v, ids).counts.p2, 1); });
test('رأی مساوی با قانون «رأی‌گیری مجدد» → revote', () => {
  const t = G.tally({ p0: 'p1', p1: 'p0', p2: 'p1', p3: 'p0', p4: 'p2' }, ids);
  const d = G.resolveVote(t, { tieRule: 'revote' }, 0);
  assert.strictEqual(d.status, 'revote'); assert.deepStrictEqual(d.tied.sort(), ['p0', 'p1']);
});
test('مساوی پس از رأی‌گیری مجدد → tie-final', () => {
  const t = G.tally({ p0: 'p1', p1: 'p0' }, ['p0', 'p1']);
  assert.strictEqual(G.resolveVote(t, { tieRule: 'revote' }, L.maxTieRevotes).status, 'tie-final');
});
test('قانون «جاسوس برنده» → مساوی فوراً نهایی', () => {
  const t = G.tally({ p0: 'p1', p1: 'p0' }, ['p0', 'p1']);
  assert.strictEqual(G.resolveVote(t, { tieRule: 'spies' }, 0).status, 'tie-final');
});

console.log('امتیازدهی');
const SC = CONFIG.DEFAULT_SCORING; const pl5 = mkPlayers(5);
test('لو رفتن جاسوس: عادی‌ها امتیاز می‌گیرند + پاداش رأی درست', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0'], outcome: 'spy-caught', votes: { p1: 'p0', p2: 'p0', p3: 'p4', p4: 'p0', p0: 'p1' }, scoring: SC });
  assert.strictEqual(r.side, 'normal'); assert.strictEqual(r.deltas.p0, 0);
  assert.strictEqual(r.deltas.p1, SC.normalWinCatch + SC.correctVoteBonus);
  assert.strictEqual(r.deltas.p3, SC.normalWinCatch);
});
test('فرار جاسوس: فقط جاسوس امتیاز می‌گیرد', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0'], outcome: 'spy-escaped', votes: { p1: 'p2', p2: 'p3', p3: 'p2', p4: 'p2', p0: 'p1' }, scoring: SC });
  assert.strictEqual(r.side, 'spy'); assert.strictEqual(r.deltas.p0, SC.spyEscape);
  ['p1', 'p2', 'p3', 'p4'].forEach((id) => assert.strictEqual(r.deltas[id], 0));
});
test('حدس درست جاسوس: امتیاز بیشتر از فرار', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0'], outcome: 'spy-guessed', votes: {}, scoring: SC });
  assert.strictEqual(r.deltas.p0, SC.spyGuessCorrect); assert(SC.spyGuessCorrect > SC.spyEscape);
});
test('چند جاسوس: همه جاسوس‌ها امتیاز می‌گیرند', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0', 'p1'], outcome: 'spy-escaped', votes: {}, scoring: SC });
  assert.strictEqual(r.deltas.p0, SC.spyEscape); assert.strictEqual(r.deltas.p1, SC.spyEscape); assert.strictEqual(r.deltas.p2, 0);
});
test('پایان زمان (قانون جاسوس برنده): بدون پاداش رأی', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0'], outcome: 'timeout-escape', votes: { p1: 'p0' }, scoring: SC });
  assert.strictEqual(r.side, 'spy'); assert.strictEqual(r.deltas.p1, 0); assert.strictEqual(r.deltas.p0, SC.spyEscape);
});
test('پایان زودهنگام: هیچ امتیازی ثبت نمی‌شود', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0'], outcome: 'aborted', votes: { p1: 'p0' }, scoring: SC });
  assert.strictEqual(r.side, 'none'); assert(Object.values(r.deltas).every((v) => v === 0));
});
test('امتیازها قابل تنظیم‌اند (تغییر تنظیمات مرکزی)', () => {
  const r = G.scoreRound({ players: pl5, spyIds: ['p0'], outcome: 'spy-escaped', votes: {}, scoring: Object.assign({}, SC, { spyEscape: 7 }) });
  assert.strictEqual(r.deltas.p0, 7);
});

console.log('دور جدید، جدول و آمار');
test('چند دور پشت‌سرهم: کلمه تکراری نیست و جدول درست جمع می‌شود', () => {
  const pl = mkPlayers(4); const used = new Set(); const totals = { p0: 0, p1: 0, p2: 0, p3: 0 }; const words = new Set();
  for (let round = 0; round < 6; round++) {
    const pick = G.pickWord({ catIds: ['places', 'animals'], bank: BANK, used, mixRandom: false });
    words.add(pick.word);
    const rd = G.createRound({ players: pl, spyCount: 1, word: pick.word, catId: pick.catId });
    const r = G.scoreRound({ players: pl, spyIds: rd.spyIds, outcome: 'spy-escaped', votes: {}, scoring: SC });
    pl.forEach((p) => { totals[p.id] += r.deltas[p.id]; });
  }
  assert.strictEqual(words.size, 6);
  assert.strictEqual(Object.values(totals).reduce((a, b) => a + b, 0), 6 * SC.spyEscape);
});
test('رتبه‌بندی با امتیاز مساوی رتبه مشترک می‌دهد و برندگان چندگانه‌اند', () => {
  const pl = mkPlayers(3); const rows = G.rank(pl, { p0: 5, p1: 5, p2: 2 });
  assert.deepStrictEqual(rows.map((r) => r.rank), [1, 1, 3]);
  assert.strictEqual(G.winners(pl, { p0: 5, p1: 5, p2: 2 }).length, 2);
  assert.strictEqual(G.winners(pl, { p0: 0, p1: 0, p2: 0 }).length, 0);
});
test('آمار: دور لغوشده ثبت نمی‌شود؛ برد و امتیاز تجمیع می‌شود', () => {
  const st = G.emptyStats(); const pl = mkPlayers(3);
  G.recordRound(st, { players: pl, spyIds: ['p0'], deltas: { p0: 0, p1: 2, p2: 2 }, side: 'normal', outcome: 'spy-caught' });
  G.recordRound(st, { players: pl, spyIds: ['p0'], deltas: { p0: 0, p1: 0, p2: 0 }, side: 'none', outcome: 'aborted' });
  G.recordGame(st, { players: pl, totals: { p0: 0, p1: 2, p2: 2 } });
  assert.strictEqual(st.rounds, 1); assert.strictEqual(st.games, 1); assert.strictEqual(st.normalWins, 1);
  assert.strictEqual(st.players.find((p) => p.name === 'بازیکن 2').wins, 1);
  assert.strictEqual(st.players.find((p) => p.name === 'بازیکن 1').spyRounds, 1);
});
test('آمار فقط نام و امتیاز دارد؛ کلمه یا نقش لو نمی‌رود', () => {
  const st = G.emptyStats(); const pl = mkPlayers(3);
  G.recordRound(st, { players: pl, spyIds: ['p0'], deltas: { p0: 3, p1: 0, p2: 0 }, side: 'spy', outcome: 'spy-escaped' });
  assert(!/word|secret|role/i.test(JSON.stringify(Object.keys(st.players[0]))));
});

console.log(`\nنتیجه: ${pass} موفق، ${fail} ناموفق`);
process.exit(fail ? 1 : 0);
