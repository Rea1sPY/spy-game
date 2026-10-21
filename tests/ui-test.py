"""تست رابط با Chromium (Playwright): یک بازی کامل + سناریوهای مهم.  python3 tests/ui-test.py"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'app/src/main/assets/index.html') + '?debug=1'
SHOTS = os.path.join(ROOT, 'tests', 'screenshots'); os.makedirs(SHOTS, exist_ok=True)
results = []; errors = []

def ok(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('  ✓ ' if cond else '  ✗ ') + name + (' — ' + str(extra) if (extra and not cond) else ''))

async def click(page, act, **attrs):
    sel = f'[data-act="{act}"]' + ''.join(f'[data-{k}="{v}"]' for k, v in attrs.items())
    await page.click(sel); await page.wait_for_timeout(60)

async def state(page, expr):
    return await page.evaluate(f'(() => {{ const s = window.__spyState; return {expr}; }})()')

async def unlock(page):
    await page.wait_for_function('window.__spyState.ui.lockUntil < Date.now()')
    await page.wait_for_timeout(30)

async def reveal_all(page, n, expect_spy_ids):
    seen_words = []
    for i in range(n):
        await unlock(page)
        html = await page.inner_html('#app')
        word = await state(page, 's.round.word')
        ok(f'قبل از نمایش نقش {i+1}: کلمه مخفی در DOM نیست', word not in html)
        await click(page, 'reveal')
        txt = await page.inner_text('#app')
        spy = await state(page, f's.round.spyIds.includes(s.game.players[{i}].id)')
        if spy: ok(f'بازیکن {i+1} جاسوس: «تو جاسوسی!» نمایش داده شد و کلمه نه', 'تو جاسوسی!' in txt and word not in txt)
        else: ok(f'بازیکن {i+1} عادی: کلمه نمایش داده شد', word in txt)
        await click(page, 'understood')
        html2 = await page.inner_html('#app')
        ok(f'پس از «متوجه شدم» نقش {i+1} از DOM پاک شد', word not in html2 or (await state(page, "s.screen")) == 'timer' and word not in html2)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='fa-IR')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
        await page.goto(URL); await page.wait_for_timeout(400)
        await page.screenshot(path=f'{SHOTS}/01-home.png')
        txt = await page.inner_text('#app')
        ok('صفحه شروع: نام بازی نمایش داده می‌شود', 'جاسوس' in txt and 'SPY' in txt)
        ok('جهت صفحه RTL است', await page.evaluate('getComputedStyle(document.body).direction') == 'rtl')

        # تنظیمات
        await click(page, 'newGame'); await page.screenshot(path=f'{SHOTS}/02-setup.png')
        for _ in range(3): await click(page, 'step', key='playerCount', d='-1')
        t = await page.inner_text('#app')
        ok('حداقل ۳ بازیکن: پیام خطای فارسی', 'حداقل ۳ بازیکن' in t)
        await click(page, 'step', key='spyCount', d='1')
        ok('بیش از حد مجاز جاسوس: پیام خطا', 'حداکثر ۱ جاسوس' in await page.inner_text('#app'))
        for _ in range(3): await click(page, 'step', key='playerCount', d='1')   # 4 نفر
        await click(page, 'step', key='playerCount', d='1')                      # 5
        await click(page, 'step', key='spyCount', d='1')                         # 2 جاسوس
        ok('۵ بازیکن و ۲ جاسوس مجاز است', await state(page, 's.setup.spyCount') == 2)
        await click(page, 'step', key='playerCount', d='-1')                     # 6 بازیکن: ۲ جاسوس هنوز مجاز
        ok('۶ بازیکن و ۲ جاسوس', await state(page, 's.setup.playerCount == 6 && s.setup.spyCount == 2'))
        for _ in range(30): await click(page, 'step', key='playerCount', d='1')
        ok('حداکثر ۲۰ بازیکن اعمال می‌شود', await state(page, 's.setup.playerCount') == 20)
        for _ in range(16): await click(page, 'step', key='playerCount', d='-1')
        ok('بازگشت به ۴ بازیکن و کاهش خودکار جاسوس‌ها به ۱', await state(page, 's.setup.playerCount == 4 && s.setup.spyCount == 1'))
        await click(page, 'time', v='1'); await click(page, 'step', key='rounds', d='-1'); await click(page, 'step', key='rounds', d='-1')
        ok('۱ دور و ۱ دقیقه', await state(page, 's.setup.rounds == 1 && s.setup.timeMinutes == 1'))
        await click(page, 'seg', key='timeoutRule', v='spies'); await click(page, 'seg', key='timeoutRule', v='vote')

        # دسته‌ها
        await click(page, 'toCats'); await page.screenshot(path=f'{SHOTS}/03-categories.png')
        await click(page, 'catNone'); await click(page, 'toNames')
        ok('بدون دسته: پیام خطا و ماندن در صفحه', 'حداقل یک دسته' in await page.inner_text('#app') and await state(page, 's.screen') == 'cats')
        await click(page, 'catToggle', id='fruits'); await click(page, 'catToggle', id='animals')
        ok('انتخاب چند دسته', await state(page, 's.setup.categories.length') == 2)
        await click(page, 'toNames')

        # نام‌ها: تکراری
        await page.fill('[data-i="0"]', 'علی'); await page.fill('[data-i="1"]', 'علی')
        await page.fill('[data-i="2"]', 'سارا'); await page.fill('[data-i="3"]', 'نیما')
        await click(page, 'startGame')
        ok('نام تکراری رد می‌شود', 'تکراری' in await page.inner_text('#app') and await state(page, 's.game') is None)
        await page.fill('[data-i="1"]', 'مریم'); await page.screenshot(path=f'{SHOTS}/04-names.png')
        await click(page, 'startGame')
        ok('بازی شروع شد و صفحه نقش نمایش داده شد', await state(page, 's.screen') == 'reveal')
        await page.evaluate("window.__spyState.round.word = 'کلمه‌ی‌آزمون‌یکتا'")
        cats = await state(page, 's.round.catId')
        ok('کلمه از دسته‌های انتخاب‌شده است', cats in ('fruits', 'animals'))
        ok('دقیقاً ۱ جاسوس', await state(page, 's.round.spyIds.length') == 1)
        await page.screenshot(path=f'{SHOTS}/05-reveal-hidden.png')

        # بازگشت اندروید در صفحه نقش: نباید اطلاعات فاش شود
        await click(page, 'reveal'); await page.screenshot(path=f'{SHOTS}/06-reveal-shown.png')
        r = await page.evaluate('window.__spyBack()')
        word = await state(page, 's.round.word'); html = await page.inner_html('#app')
        ok('دکمه بازگشت در صفحه نقش: پرسش خروج و پاک شدن نقش', r is True and word not in html and 'لغو بازی' in html)
        await click(page, 'mCancel')
        # لمس ساده نباید نقش را نشان دهد
        await page.mouse.click(195, 400)
        ok('لمس ساده صفحه نقش را فاش نمی‌کند', word not in await page.inner_html('#app'))
        # قفل ضد دوبار لمس
        await click(page, 'reveal'); await click(page, 'understood')
        await page.click('[data-act="reveal"]', force=True)
        ok('لمس سریع پس از «متوجه شدم» نقش نفر بعد را نشان نمی‌دهد', word not in await page.inner_html('#app') and await state(page, 's.round.revealShown') is False)
        # ادامه نقش‌ها
        for i in range(1, 4):
            await unlock(page); await click(page, 'reveal')
            await unlock(page); await page.wait_for_timeout(10); await click(page, 'understood')
        ok('پس از دیدن همه نقش‌ها زمان‌سنج نمایش داده شد', await state(page, 's.screen') == 'timer')
        html = await page.inner_html('#app')
        ok('صفحه عمومی زمان‌سنج کلمه را نشان نمی‌دهد', word not in html)
        ok('نام آغازکننده سؤال‌ها نمایش داده شد', 'آغازکننده' in html)
        await page.screenshot(path=f'{SHOTS}/07-timer-ready.png')

        # زمان‌سنج
        await click(page, 'tstart'); await page.wait_for_timeout(1300)
        t1 = await page.inner_text('#t-text')
        await click(page, 'tpause'); t2 = await page.inner_text('#t-text'); await page.wait_for_timeout(1200)
        t3 = await page.inner_text('#t-text')
        ok('توقف زمان‌سنج کار می‌کند', t2 == t3, (t2, t3))
        await click(page, 'tresume'); await page.wait_for_timeout(1100)
        ok('ادامه زمان‌سنج کار می‌کند', await page.inner_text('#t-text') != t3)
        await page.screenshot(path=f'{SHOTS}/08-timer-running.png')

        # پایان زودهنگام + لغو
        await click(page, 'tabort'); ok('پایان زودهنگام تأیید می‌خواهد', 'پایان زودهنگام' in await page.inner_text('.sheet'))
        await click(page, 'mCancel'); ok('انصراف: دور ادامه دارد', await state(page, 's.screen') == 'timer')

        # پایان زمان (شبیه‌سازی): endAt را به گذشته ببریم
        await page.evaluate('window.__spyState.round.timer.endAt = Date.now() + 500')
        await page.wait_for_timeout(1200)
        ok('پایان زمان: وضعیت «تمام شد»', await state(page, 's.round.timer.state') == 'up' and 'زمان تمام شد' in await page.inner_text('#app'))
        await page.screenshot(path=f'{SHOTS}/09-timer-up.png')

        # رأی‌گیری: همه به یک نفر غیرجاسوس → مساوی ساختگی ابتدا
        await click(page, 'tvote')
        ids = await state(page, 's.game.players.map(p=>p.id)'); spy = await state(page, 's.round.spyIds[0]')
        await page.screenshot(path=f'{SHOTS}/10-vote.png')
        # مساوی: p0->p1, p1->p0, p2->p1, p3->p0
        plan = {ids[0]: ids[1], ids[1]: ids[0], ids[2]: ids[1], ids[3]: ids[0]}
        for i in range(4):
            await unlock(page)
            voter = await state(page, 's.game.players[s.round.voteIdx].id')
            ok(f'رأی‌دهنده {i+1}: خودش در فهرست گزینه‌ها نیست', f'data-id="{voter}"' not in await page.inner_html('.body'))
            await click(page, 'vpick', id=plan[voter]); await click(page, 'vsubmit')
        ok('رأی مساوی: نتیجه نهایی نمایش داده نمی‌شود و پیام مساوی می‌آید', 'آرا مساوی شد' in await page.inner_text('#app'))
        await page.screenshot(path=f'{SHOTS}/11-tie.png')
        await click(page, 'vcontinue')
        ok('رأی‌گیری مجدد فقط بین افراد مساوی', await state(page, 's.round.candidates.length') == 2 and await state(page, 's.round.tieCount') == 1)
        # رأی دوم: همه به جاسوس
        for i in range(4):
            await unlock(page)
            voter = await state(page, 's.game.players[s.round.voteIdx].id')
            cands = await state(page, 's.round.candidates.filter(id => id !== s.game.players[s.round.voteIdx].id)')
            tgt = spy if spy in cands else cands[0]
            await click(page, 'vpick', id=tgt); await click(page, 'vsubmit')
        await page.screenshot(path=f'{SHOTS}/12-voteresult.png')
        await click(page, 'vcontinue')
        acc = await state(page, 's.round.accusedId')
        if acc == spy:
            ok('متهم جاسوس است → صفحه حدس', await state(page, 's.screen') == 'guess')
            word = await state(page, 's.round.word')
            ok('کلمه اصلی در صفحه حدس نمایش داده نمی‌شود جز در گزینه‌ها', word not in await page.inner_text('.banner') and word not in await page.input_value('#guess-input'))
            await page.screenshot(path=f'{SHOTS}/13-guess.png')
            await page.fill('#guess-input', word.replace(' ', '  ') + ' ')
            await click(page, 'gsubmit')
            ok('حدس درست (با فاصله اضافه): جاسوس برنده', await state(page, 's.round.outcome') == 'spy-guessed')
        else:
            ok('متهم غیرجاسوس: جاسوس فرار کرد', await state(page, 's.round.outcome') == 'spy-escaped')
        await page.screenshot(path=f'{SHOTS}/14-result.png')
        rd = await state(page, 's.round.result.deltas')
        ok('امتیاز دور ثبت شد', sum(rd.values()) > 0)
        await click(page, 'toScores'); await page.screenshot(path=f'{SHOTS}/15-scores.png')
        ok('دور آخر: دکمه نتیجه نهایی', await page.query_selector('[data-act="toFinal"]') is not None)
        await click(page, 'toFinal'); await page.screenshot(path=f'{SHOTS}/16-final.png')
        ok('صفحه نتیجه نهایی', await state(page, 's.screen') == 'final')
        stats = await page.evaluate('JSON.parse(localStorage.getItem("spy.v1.stats"))')
        ok('آمار ذخیره شد (۱ بازی، ۱ دور)', stats['games'] == 1 and stats['rounds'] == 1)
        ls = await page.evaluate('JSON.stringify(Object.assign({}, localStorage))')
        w = await state(page, 's.round.word')
        ok('کلمه مخفی در ذخیره‌سازی محلی نیست', w not in ls and 'spyIds' not in ls)

        # بازی دوباره = دور جدید با کلمه متفاوت
        w1 = w
        await click(page, 'again')
        ok('بازی دوباره: دور جدید و نقش‌های تازه', await state(page, 's.screen') == 'reveal' and await state(page, 's.game.roundNo') == 1 and await state(page, 's.game.totals[s.game.players[0].id]') == 0)

        # لغو بازی
        await page.evaluate('window.__spyBack()'); await click(page, 'mOk')
        ok('لغو بازی به منوی اصلی برمی‌گردد و داده‌ها پاک می‌شوند', await state(page, 's.screen') == 'home' and await state(page, 's.round') is None)

        # ماندگاری تنظیمات پس از بارگذاری مجدد
        await page.reload(); await page.wait_for_timeout(300)
        await click(page, 'newGame')
        ok('تنظیمات پس از بستن و باز کردن حفظ می‌شود', await state(page, 's.setup.playerCount == 4 && s.setup.rounds == 1 && s.setup.timeMinutes == 1'))
        await click(page, 'toCats'); await click(page, 'toNames')
        ok('نام بازیکنان حفظ می‌شود', await page.input_value('[data-i="0"]') == 'علی')

        # صفحه‌های جانبی
        await page.evaluate('window.__spyBack()'); await page.evaluate('window.__spyBack()'); await page.evaluate('window.__spyBack()')
        ok('بازگشت مرحله‌ای تا منوی اصلی', await state(page, 's.screen') == 'home' and await page.evaluate('window.__spyBack()') is False)
        for scr, key in (('help', 'راهنمای بازی'), ('stats', 'آمار و رکوردها'), ('settings', 'تنظیمات')):
            await click(page, 'go', to=scr); ok(f'صفحه {key} باز می‌شود', key in await page.inner_text('.top h1'))
            await page.screenshot(path=f'{SHOTS}/17-{scr}.png')
            await page.evaluate('window.__spyBack()')
        await click(page, 'go', to='settings'); await click(page, 'sstep', key='spyEscape', d='1')
        ok('تغییر امتیاز در تنظیمات ذخیره می‌شود', await page.evaluate('JSON.parse(localStorage.getItem("spy.v1.general")).scoring.spyEscape') == 4)
        await click(page, 'resetScoring'); ok('بازگشت امتیازها به پیش‌فرض', await state(page, 's.general.scoring.spyEscape') == 3)
        await click(page, 'gtog', key='sound'); ok('خاموش کردن صدا', await state(page, 's.general.sound') is False)

        # سناریو: حدس غلط و جاسوس برنده با قانون پایان زمان
        await page.evaluate('window.__spyBack()')
        await click(page, 'newGame'); await click(page, 'seg', key='timeoutRule', v='spies'); await click(page, 'toCats'); await click(page, 'toNames'); await click(page, 'startGame')
        for i in range(4):
            await unlock(page); await click(page, 'reveal'); await unlock(page); await click(page, 'understood')
        await click(page, 'tstart'); await page.evaluate('window.__spyState.round.timer.endAt = Date.now() + 300'); await page.wait_for_timeout(900)
        await click(page, 'timeoutWin')
        ok('پایان زمان با قانون «جاسوس برنده»', await state(page, 's.round.outcome') == 'timeout-escape')
        await page.screenshot(path=f'{SHOTS}/18-timeout-result.png')
        await page.evaluate('window.__spyBack()'); await click(page, 'mOk')

        # حدس غلط (۲ دور): رأی همه به جاسوس
        await click(page, 'newGame')
        await click(page, 'seg', key='timeoutRule', v='vote'); await click(page, 'toCats'); await click(page, 'toNames'); await click(page, 'startGame')
        for i in range(4):
            await unlock(page); await click(page, 'reveal'); await unlock(page); await click(page, 'understood')
        await click(page, 'tstart'); await click(page, 'tvote')
        spy = await state(page, 's.round.spyIds[0]')
        for i in range(4):
            await unlock(page)
            cands = await state(page, 's.round.candidates.filter(id => id !== s.game.players[s.round.voteIdx].id)')
            await click(page, 'vpick', id=spy if spy in cands else cands[0]); await click(page, 'vsubmit')
        await click(page, 'vcontinue')
        ok('همه به جاسوس رأی دادند → مرحله حدس', await state(page, 's.screen') == 'guess')
        await page.fill('#guess-input', 'کلمه‌ی کاملاً نامربوط'); await click(page, 'gsubmit')
        ok('حدس غلط: بازیکنان عادی برنده', await state(page, 's.round.outcome') == 'spy-caught' and await state(page, 's.round.result.side') == 'normal')
        await page.screenshot(path=f'{SHOTS}/19-result-normal.png')

        # ابعاد صفحه کوچک
        await page.set_viewport_size({'width': 320, 'height': 568}); await page.wait_for_timeout(200)
        ov = await page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
        ok('بدون اسکرول افقی در صفحه ۳۲۰×۵۶۸', not ov)
        await page.screenshot(path=f'{SHOTS}/20-small-screen.png')
        await b.close()

    bad = [e for e in errors if 'Vazirmatn' not in e and 'favicon' not in e]
    ok('بدون خطای جاوااسکریپت در کنسول', not bad, bad[:3])
    passed = sum(1 for _, c in results if c)
    print(f'\nنتیجه: {passed} موفق، {len(results) - passed} ناموفق')
    sys.exit(0 if passed == len(results) else 1)

asyncio.run(main())
