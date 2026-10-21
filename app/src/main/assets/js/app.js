/* رابط کاربری و روند بازی «جاسوس | SPY» */
(function () {
  'use strict';
  const SPY = globalThis.SPY;
  const { CONFIG, Game: G, Storage, Audio, Native } = SPY;
  const L = CONFIG.LIMITS;
  const BANK = SPY.WORD_BANK;
  const fa = G.fa;
  const DEBUG = /[?&]debug=1/.test(location.search);
  const SECRET_SCREENS = ['reveal', 'vote', 'guess'];
  const $app = document.getElementById('app');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

  /* ---------- حالت برنامه ---------- */
  const state = {
    screen: 'home',
    setup: loadSetup(),
    general: loadGeneral(),
    stats: Storage.get('stats', null) || G.emptyStats(),
    game: null,
    round: null,
    used: new Set(), // کلمه‌های استفاده‌شده در این نشست (ذخیره نمی‌شود)
    ui: { modal: null, error: '', lockUntil: 0 },
  };
  if (DEBUG) globalThis.__spyState = state;

  function loadSetup() {
    const d = CONFIG.DEFAULT_SETTINGS;
    const s = Object.assign({}, d, Storage.get('settings', {}) || {});
    s.categories = Array.isArray(s.categories) ? s.categories.filter((id) => BANK.some((c) => c.id === id)) : [];
    if (!s.categories.length) s.categories = d.categories.slice();
    s.names = Array.isArray(s.names) ? s.names.map(String).slice(0, L.maxPlayers) : [];
    s.playerCount = G.clamp(int(s.playerCount, d.playerCount), L.minPlayers, L.maxPlayers);
    s.spyCount = G.clamp(int(s.spyCount, 1), 1, G.maxSpies(s.playerCount));
    s.rounds = G.clamp(int(s.rounds, d.rounds), L.minRounds, L.maxRounds);
    if (!CONFIG.TIME_OPTIONS.includes(s.timeMinutes)) s.timeMinutes = d.timeMinutes;
    if (!['revote', 'spies'].includes(s.tieRule)) s.tieRule = d.tieRule;
    if (!['vote', 'spies'].includes(s.timeoutRule)) s.timeoutRule = d.timeoutRule;
    ['spyGuess', 'showGuide', 'mixRandom'].forEach((k) => { s[k] = !!s[k]; });
    return s;
  }
  function loadGeneral() {
    const g = Object.assign({}, CONFIG.DEFAULT_GENERAL, Storage.get('general', {}) || {});
    const sc = Object.assign({}, CONFIG.DEFAULT_SCORING, g.scoring || {});
    Object.keys(CONFIG.DEFAULT_SCORING).forEach((k) => {
      sc[k] = G.clamp(int(sc[k], CONFIG.DEFAULT_SCORING[k]), CONFIG.SCORING_RANGE.min, CONFIG.SCORING_RANGE.max);
    });
    g.scoring = sc;
    return g;
  }
  const saveSetup = () => Storage.set('settings', state.setup);
  const saveGeneral = () => Storage.set('general', state.general);
  const saveStats = () => Storage.set('stats', state.stats);
  function applyGeneral() { Audio.soundOn = !!state.general.sound; Audio.vibrationOn = !!state.general.vibration; }
  applyGeneral();

  /* ---------- آیکون‌ها ---------- */
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" transform="scale(-1,1) translate(-24,0)"/></svg>',
  };
  const LOGO = `<svg class="logo" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="gl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#6d28d9" stop-opacity=".55"/><stop offset="1" stop-color="#6d28d9" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="96" fill="url(#gl)"/>
    <circle cx="100" cy="100" r="78" fill="#0f0b20" stroke="#2c2658" stroke-width="3"/>
    <path d="M52 98c0-9 22-15 48-15s48 6 48 15-22 16-48 16-48-7-48-16z" fill="#a78bfa"/>
    <path d="M72 88l5-30c0-7 46-7 46 0l5 30c-10 5-46 5-56 0z" fill="#6d28d9"/>
    <path d="M74 80h52l1 8c-10 5-44 5-54 0z" fill="#38bdf8"/>
    <ellipse class="eye" cx="80" cy="132" rx="13" ry="6" fill="#38bdf8"/>
    <ellipse class="eye" cx="120" cy="132" rx="13" ry="6" fill="#38bdf8"/>
  </svg>`;

  /* ---------- اجزای رابط ---------- */
  const header = (title, backTo, right) =>
    `<div class="top">${backTo ? `<button class="icon-btn" data-act="back" aria-label="بازگشت">${ICON.back}</button>` : '<span class="icon-btn ghosted"></span>'}<h1>${title}</h1><div class="top-r">${right || ''}</div></div>`;
  const stepper = (key, val, scope) =>
    `<div class="stepper"><button data-act="${scope || 'step'}" data-key="${key}" data-d="-1" aria-label="کم">−</button><b>${fa(val)}</b><button data-act="${scope || 'step'}" data-key="${key}" data-d="1" aria-label="زیاد">+</button></div>`;
  const toggle = (key, on, scope) => `<div class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}"></div>`;
  const toggleRow = (key, label, sub, on, act) =>
    `<div class="row" data-act="${act || 'tog'}" data-key="${key}"><div><div class="lbl">${label}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${toggle(key, on)}</div>`;
  const errBox = () => (state.ui.error ? `<div class="note err">${esc(state.ui.error)}</div>` : '');
  const catHue = (i) => 215 + ((i * 23) % 95);

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ---------- صفحه‌ها ---------- */
  const SCREENS = {};

  SCREENS.home = () => `
    <div class="hero">
      ${LOGO}
      <div class="brand">جاسوس</div>
      <div class="brand-sub">SPY</div>
      <div class="tag">بازی حضوری با یک گوشی · کاملاً آفلاین</div>
    </div>
    <div class="menu">
      <button class="btn primary" data-act="newGame">بازی جدید</button>
      <button class="btn" data-act="go" data-to="help">راهنمای بازی</button>
      <div class="seg">
        <button class="btn ghost" data-act="go" data-to="stats">آمار و رکوردها</button>
        <button class="btn ghost" data-act="go" data-to="settings">تنظیمات</button>
      </div>
    </div>`;

  SCREENS.setup = () => {
    const s = state.setup;
    const max = G.maxSpies(s.playerCount);
    return `${header('تنظیمات بازی', true, 'مرحله ' + fa(1) + ' از ' + fa(3))}
    <div class="body">
      ${errBox()}
      <div class="group">
        <div class="row"><div><div class="lbl">تعداد بازیکنان</div><div class="sub">${fa(L.minPlayers)} تا ${fa(L.maxPlayers)} نفر</div></div>${stepper('playerCount', s.playerCount)}</div>
        <div class="row"><div><div class="lbl">تعداد جاسوس‌ها</div><div class="sub">حداکثر ${fa(max)} نفر برای ${fa(s.playerCount)} بازیکن</div></div>${stepper('spyCount', s.spyCount)}</div>
        <div class="row"><div><div class="lbl">تعداد دورها</div></div>${stepper('rounds', s.rounds)}</div>
        <div class="row col"><div class="lbl">زمان هر دور (دقیقه)</div>
          <div class="chips">${CONFIG.TIME_OPTIONS.map((m) => `<button class="chip ${s.timeMinutes === m ? 'on' : ''}" data-act="time" data-v="${m}">${fa(m)}</button>`).join('')}</div></div>
      </div>
      <div class="sec-title">گزینه‌ها</div>
      <div class="group">
        ${toggleRow('spyGuess', 'حدس کلمه توسط جاسوس', 'جاسوسِ لو رفته فرصت حدس کلمه را دارد', s.spyGuess)}
        ${toggleRow('showGuide', 'نمایش راهنمای کوتاه', 'در صفحه زمان‌سنج', s.showGuide)}
        ${toggleRow('mixRandom', 'ترکیب تصادفی دسته‌ها', 'هر دور ابتدا یک دسته تصادفی انتخاب می‌شود', s.mixRandom)}
      </div>
      <div class="sec-title">قوانین پایان دور</div>
      <div class="group">
        <div class="row col"><div class="lbl">اگر آرا مساوی شد</div>
          <div class="seg"><button class="chip ${s.tieRule === 'revote' ? 'on' : ''}" data-act="seg" data-key="tieRule" data-v="revote">رأی‌گیری مجدد</button><button class="chip ${s.tieRule === 'spies' ? 'on' : ''}" data-act="seg" data-key="tieRule" data-v="spies">جاسوس برنده</button></div></div>
        <div class="row col"><div class="lbl">اگر زمان تمام شد</div>
          <div class="seg"><button class="chip ${s.timeoutRule === 'vote' ? 'on' : ''}" data-act="seg" data-key="timeoutRule" data-v="vote">رفتن به رأی‌گیری</button><button class="chip ${s.timeoutRule === 'spies' ? 'on' : ''}" data-act="seg" data-key="timeoutRule" data-v="spies">جاسوس برنده</button></div></div>
      </div>
    </div>
    <div class="foot"><button class="btn primary" data-act="toCats">ادامه: انتخاب دسته‌ها</button></div>`;
  };

  function catStats() {
    const sel = state.setup.categories;
    const words = BANK.filter((c) => sel.includes(c.id)).reduce((a, c) => a + c.words.length, 0);
    return { n: sel.length, words };
  }

  SCREENS.cats = () => {
    const sel = state.setup.categories;
    const st = catStats();
    const all = sel.length === BANK.length;
    return `${header('دسته‌بندی‌ها', true, 'مرحله ' + fa(2) + ' از ' + fa(3))}
    <div class="body">
      ${errBox()}
      <div class="note info">${fa(st.n)} دسته انتخاب شده · ${fa(st.words)} کلمه</div>
      <div class="seg" style="margin-bottom:12px">
        <button class="chip" data-act="catAll">انتخاب همه</button>
        <button class="chip" data-act="catNone">پاک کردن انتخاب‌ها</button>
      </div>
      <div class="grid">
        <button class="cat mix ${all ? 'on' : ''}" data-act="catAll"><span class="tick">✓</span><span class="ic" style="background:hsla(270,80%,60%,.22)">🎲</span><span><span class="nm">ترکیب تصادفی تمام دسته‌ها</span><br><span class="ct">${fa(BANK.length)} دسته · ${fa(BANK.reduce((a, c) => a + c.words.length, 0))} کلمه</span></span></button>
        ${BANK.map((c, i) => `<button class="cat ${sel.includes(c.id) ? 'on' : ''}" data-act="catToggle" data-id="${c.id}"><span class="tick">✓</span><span class="ic" style="background:hsla(${catHue(i)},80%,60%,.2)">${c.icon}</span><span class="nm">${esc(c.name)}</span><span class="ct">${fa(c.words.length)} کلمه</span></button>`).join('')}
      </div>
    </div>
    <div class="foot"><button class="btn primary" data-act="toNames">ادامه: نام بازیکنان</button></div>`;
  };

  SCREENS.names = () => {
    const s = state.setup;
    let rows = '';
    for (let i = 0; i < s.playerCount; i++) {
      rows += `<div class="field"><span class="idx">${fa(i + 1)}</span><input class="inp" data-input="name" data-i="${i}" value="${esc(s.names[i] || '')}" maxlength="${L.maxNameLength}" placeholder="بازیکن ${fa(i + 1)}" autocomplete="off"></div>`;
    }
    return `${header('نام بازیکنان', true, 'مرحله ' + fa(3) + ' از ' + fa(3))}
    <div class="body">${errBox()}<div class="sec-title">نام را خالی بگذارید تا نام پیش‌فرض استفاده شود. نام‌ها باید متفاوت باشند.</div>${rows}</div>
    <div class="foot"><button class="btn primary" data-act="startGame">شروع بازی</button></div>`;
  };

  SCREENS.reveal = () => {
    const r = state.round, g = state.game;
    const p = g.players[r.revealIndex];
    const isSpy = r.spyIds.includes(p.id);
    const prog = `بازیکن ${fa(r.revealIndex + 1)} از ${fa(g.players.length)}`;
    if (!r.revealShown) {
      return `${header('نمایش نقش', false, prog)}
      <div class="body"><div class="reveal-box">
        <span class="badge">دور ${fa(g.roundNo)} از ${fa(g.settings.rounds)}</span>
        <div class="pname">${esc(p.name)}</div>
        <div class="warn-line">گوشی را فقط خودت ببین!<br>بقیه نگاه نکنند.</div>
        <button class="btn primary" style="max-width:320px;margin-top:18px" data-lockable data-act="reveal">نمایش نقش</button>
      </div></div>`;
    }
    const content = isSpy
      ? `<div class="role-spy">تو جاسوسی!</div><div class="warn-line">کلمه را نمی‌دانی. از صحبت‌های بقیه حدس بزن<br>و خودت را لو نده.</div>`
      : `<div class="warn-line">کلمه مخفی</div><div class="role-word">${esc(r.word)}</div><div class="warn-line">یکی از بازیکنان جاسوس است.</div>`;
    return `${header('نقش تو', false, prog)}
    <div class="body"><div class="reveal-box"><div class="pname" style="font-size:22px;color:var(--muted)">${esc(p.name)}</div>${content}</div></div>
    <div class="foot"><button class="btn blue" data-act="understood">متوجه شدم</button></div>`;
  };

  function fmt(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return fa(String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'));
  }
  const RING = 2 * Math.PI * 110;
  function remainingMs(t) { return t.state === 'running' ? Math.max(0, t.endAt - Date.now()) : t.remaining; }

  SCREENS.timer = () => {
    const r = state.round, g = state.game, t = r.timer;
    const rem = remainingMs(t);
    const starter = g.players.find((p) => p.id === r.starterId);
    const warn = t.state !== 'ready' && rem <= 10000;
    const ratio = t.total ? rem / t.total : 1;
    let controls;
    if (t.state === 'ready') controls = `<button class="btn blue" data-act="tstart">شروع دور</button>`;
    else if (t.state === 'running') controls = `<button class="btn" data-act="tpause">توقف زمان‌سنج</button><button class="btn primary" data-act="tvote">پایان بحث و شروع رأی‌گیری</button>`;
    else if (t.state === 'paused') controls = `<button class="btn blue" data-act="tresume">ادامه</button><button class="btn primary" data-act="tvote">پایان بحث و شروع رأی‌گیری</button>`;
    else controls = g.settings.timeoutRule === 'vote'
      ? `<button class="btn primary" data-act="tvote">شروع رأی‌گیری</button>`
      : `<button class="btn primary" data-act="timeoutWin">نمایش نتیجه</button>`;
    const guide = g.settings.showGuide ? `<div class="guide"><ul><li>به نوبت از هم سؤال بپرسید؛ سؤال نباید کلمه را لو بدهد.</li><li>جاسوس باید خودش را شبیه بقیه نشان دهد و کلمه را حدس بزند.</li><li>در پایان رأی بدهید: جاسوس کیست؟</li></ul></div>` : '';
    return `${header('دور ' + fa(g.roundNo) + ' از ' + fa(g.settings.rounds), false, '')}
    <div class="body">
      <div class="info-line"><span class="badge">${fa(g.players.length)} بازیکن · ${fa(g.settings.spyCount)} جاسوس</span></div>
      <div class="ring-wrap ${warn ? 'warn' : ''}" id="ring-wrap">
        <svg viewBox="0 0 240 240"><circle class="ring-bg" cx="120" cy="120" r="110" fill="none" stroke-width="12"/><circle class="ring-fg" id="ring-fg" cx="120" cy="120" r="110" fill="none" stroke-width="12" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="${(RING * (1 - ratio)).toFixed(2)}"/></svg>
        <div class="ring-txt" id="t-text">${fmt(rem)}</div>
      </div>
      ${t.state === 'up' ? '<div class="timeup">زمان تمام شد!</div>' : ''}
      <div class="info-line">آغازکننده سؤال‌ها: <b>${esc(starter.name)}</b></div>
      ${guide}
    </div>
    <div class="foot">${controls}${t.state === 'ready' || t.state === 'up' ? '' : '<button class="btn danger" data-act="tabort">پایان زودهنگام دور</button>'}</div>`;
  };

  SCREENS.vote = () => {
    const r = state.round, g = state.game;
    const voter = g.players[r.voteIdx];
    const cands = g.players.filter((p) => r.candidates.includes(p.id) && p.id !== voter.id);
    const revote = r.tieCount > 0 ? `<div class="note info">رأی‌گیری مجدد بین: ${r.candidates.map((id) => esc(g.players.find((p) => p.id === id).name)).join('، ')}</div>` : '';
    return `${header('رأی‌گیری', false, 'رأی ' + fa(r.voteIdx + 1) + ' از ' + fa(g.players.length))}
    <div class="body">
      ${revote}
      <div class="center" style="margin-bottom:14px"><div class="warn-line">نوبت</div><div class="pname" style="font-size:30px">${esc(voter.name)}</div><div class="warn-line" style="font-size:14px">رأی را مخفیانه ثبت کن؛ بقیه نگاه نکنند.</div></div>
      ${cands.map((p) => `<button class="pick ${r.voteSel === p.id ? 'on' : ''}" data-act="vpick" data-id="${p.id}">${esc(p.name)}</button>`).join('')}
    </div>
    <div class="foot"><button class="btn primary ${r.voteSel ? '' : 'disabled'}" data-act="vsubmit">ثبت رأی</button></div>`;
  };

  SCREENS.voteResult = () => {
    const r = state.round, g = state.game;
    const t = r.lastTally, d = r.decision;
    const max = Math.max(1, t.max);
    const rows = g.players.filter((p) => r.candidates.includes(p.id)).sort((a, b) => t.counts[b.id] - t.counts[a.id]).map((p) =>
      `<div class="bar-row ${t.leaders.includes(p.id) ? 'lead' : ''}"><div class="hd"><span>${esc(p.name)}</span><span>${fa(t.counts[p.id])} رأی</span></div><div class="bar"><i style="width:${(t.counts[p.id] / max) * 100}%"></i></div></div>`).join('');
    let msg, btn;
    if (d.status === 'accused') {
      msg = `<div class="banner none">بیشترین رأی:<br>${esc(g.players.find((p) => p.id === d.accusedId).name)}</div>`;
      btn = 'ادامه';
    } else if (d.status === 'revote') {
      msg = `<div class="banner none">آرا مساوی شد!<br><span style="font-size:16px;font-weight:600">${d.tied.map((id) => esc(g.players.find((p) => p.id === id).name)).join('، ')}</span></div>`;
      btn = 'رأی‌گیری مجدد';
    } else {
      msg = `<div class="banner none">آرا مساوی ماند!<br><span style="font-size:16px;font-weight:600">طبق قوانین، جاسوس برنده می‌شود.</span></div>`;
      btn = 'نمایش نتیجه';
    }
    return `${header('نتیجه رأی‌گیری', false, '')}<div class="body">${msg}${rows}</div><div class="foot"><button class="btn primary" data-act="vcontinue">${btn}</button></div>`;
  };

  SCREENS.guess = () => {
    const r = state.round, g = state.game;
    const spy = g.players.find((p) => p.id === r.accusedId);
    const opts = r.guessOptions.map((w) => `<button class="chip ${r.guessText === w ? 'on' : ''}" data-act="gpick" data-w="${esc(w)}">${esc(w)}</button>`).join('');
    return `${header('حدس جاسوس', false, '')}
    <div class="body">
      <div class="banner spy">${esc(spy.name)} جاسوس بود!</div>
      <div class="center warn-line" style="margin-bottom:12px">گوشی را به او بدهید. یک فرصت دارد کلمه مخفی را حدس بزند.</div>
      <input class="inp" id="guess-input" data-input="guess" value="${esc(r.guessText)}" placeholder="کلمه را بنویس…" autocomplete="off">
      <div class="sec-title" style="margin-top:16px">یا از گزینه‌های پیشنهادی انتخاب کن</div>
      <div class="chips">${opts}</div>
    </div>
    <div class="foot"><button class="btn primary ${G.normalize(r.guessText) ? '' : 'disabled'}" data-act="gsubmit">ثبت حدس</button><button class="btn ghost" data-act="gskip">نمی‌دانم</button></div>`;
  };

  function outcomeInfo(r, g) {
    const accused = r.accusedId ? g.players.find((p) => p.id === r.accusedId) : null;
    const guessLine = r.guess ? `حدس جاسوس: «${esc(r.guess.text)}»` : '';
    switch (r.outcome) {
      case 'spy-caught': return { cls: 'normal', title: 'جاسوس لو رفت!<br>بازیکنان عادی برنده شدند', line: r.guess ? guessLine + ' اشتباه بود.' : (g.settings.spyGuess ? 'جاسوس کلمه را حدس نزد.' : '') };
      case 'spy-guessed': return { cls: 'spy', title: 'جاسوس کلمه را درست حدس زد!<br>جاسوس برنده شد', line: guessLine };
      case 'spy-escaped': return { cls: 'spy', title: 'جاسوس شناسایی نشد!<br>جاسوس برنده شد', line: accused ? `«${esc(accused.name)}» جاسوس نبود.` : '' };
      case 'tie-escape': return { cls: 'spy', title: 'آرا مساوی ماند<br>جاسوس برنده شد', line: '' };
      case 'timeout-escape': return { cls: 'spy', title: 'زمان تمام شد<br>جاسوس برنده شد', line: '' };
      default: return { cls: 'none', title: 'دور زودتر تمام شد', line: 'امتیازی ثبت نشد.' };
    }
  }

  SCREENS.result = () => {
    const r = state.round, g = state.game;
    const info = outcomeInfo(r, g);
    const spies = r.spyIds.map((id) => esc(g.players.find((p) => p.id === id).name)).join('، ');
    const deltas = g.players.map((p) => ({ p, d: r.result.deltas[p.id] })).sort((a, b) => b.d - a.d);
    return `${header('نتیجه دور ' + fa(g.roundNo), false, '')}
    <div class="body">
      <div class="banner ${info.cls}">${info.title}</div>
      ${info.line ? `<div class="center warn-line" style="margin-bottom:12px">${info.line}</div>` : ''}
      <div class="group">
        <div class="kv"><span>کلمه مخفی</span><b>${esc(r.word)}</b></div>
        <div class="kv"><span>${r.spyIds.length > 1 ? 'جاسوس‌ها' : 'جاسوس'}</span><b>${spies}</b></div>
      </div>
      <div class="sec-title">امتیاز این دور</div>
      <div class="group">${deltas.map((x) => `<div class="kv"><span>${esc(x.p.name)}</span><b style="color:${x.d ? 'var(--blue)' : 'var(--muted)'}">${x.d ? '<bdi dir="ltr">+' + fa(x.d) + '</bdi>' : '—'}</b></div>`).join('')}</div>
    </div>
    <div class="foot"><button class="btn primary" data-act="toScores">جدول امتیازات</button></div>`;
  };

  function scoreTable(g) {
    const last = g.history.length ? g.history[g.history.length - 1].deltas : {};
    const rows = G.rank(g.players, g.totals);
    return `<div class="group table">${rows.map((r) => `<div class="tr ${r.rank === 1 && r.points > 0 ? 'first' : ''}"><span class="rank">${fa(r.rank)}</span><span>${esc(r.name)}</span><span class="delta">${last[r.id] ? '<bdi dir="ltr">+' + fa(last[r.id]) + '</bdi>' : ''}</span><span class="pts">${fa(r.points)}</span></div>`).join('')}</div>`;
  }

  SCREENS.scores = () => {
    const g = state.game;
    const lastRound = g.roundNo >= g.settings.rounds;
    return `${header('جدول امتیازات', false, 'دور ' + fa(g.roundNo) + ' از ' + fa(g.settings.rounds))}
    <div class="body">${scoreTable(g)}</div>
    <div class="foot">${lastRound ? '<button class="btn primary" data-act="toFinal">نتیجه نهایی</button>' : '<button class="btn primary" data-act="nextRound">شروع دور بعد</button>'}</div>`;
  };

  SCREENS.final = () => {
    const g = state.game;
    const win = G.winners(g.players, g.totals);
    const banner = win.length
      ? `<div class="banner spy">🏆 ${win.length > 1 ? 'برندگان' : 'برنده نهایی'}<br>${win.map((w) => esc(w.name)).join('، ')}</div>`
      : `<div class="banner none">بازی بدون برنده تمام شد</div>`;
    const hist = g.history.map((h) => `<div class="kv"><span>دور ${fa(h.no)}</span><b>${h.side === 'spy' ? 'جاسوس' : h.side === 'normal' ? 'بازیکنان عادی' : 'بدون امتیاز'}</b></div>`).join('');
    return `${header('نتیجه نهایی', false, '')}
    <div class="body">${banner}${scoreTable(Object.assign({}, g, { history: [] }))}<div class="sec-title">برنده هر دور</div><div class="group">${hist}</div></div>
    <div class="foot"><button class="btn primary" data-act="again">بازی دوباره با همین بازیکنان</button><button class="btn" data-act="endGame">منوی اصلی</button></div>`;
  };

  SCREENS.help = () => {
    const sc = state.general.scoring;
    return `${header('راهنمای بازی', true, '')}
    <div class="body help">
      <h3>هدف بازی</h3>
      <p>همه به‌جز جاسوس یک کلمه مخفی را می‌دانند. بازیکنان عادی باید جاسوس را پیدا کنند و جاسوس باید خودش را لو ندهد یا کلمه را حدس بزند.</p>
      <h3>روند هر دور</h3>
      <ol>
        <li>گوشی دست‌به‌دست می‌شود و هر نفر نقش خودش را مخفیانه می‌بیند و «متوجه شدم» را می‌زند.</li>
        <li>زمان‌سنج شروع می‌شود؛ بازیکنان به نوبت از هم درباره کلمه سؤال می‌پرسند. سؤال نباید کلمه را مستقیم لو بدهد.</li>
        <li>در پایان بحث، هر نفر مخفیانه به مشکوک‌ترین فرد رأی می‌دهد.</li>
        <li>اگر فرد پرآرا جاسوس باشد، فرصت دارد کلمه را حدس بزند (اگر در تنظیمات فعال باشد).</li>
      </ol>
      <h3>امتیازدهی</h3>
      <ul>
        <li>جاسوس لو برود و کلمه را درست حدس نزند: هر بازیکن عادی <b>${fa(sc.normalWinCatch)}</b> امتیاز.</li>
        <li>جاسوس شناسایی نشود: هر جاسوس <b>${fa(sc.spyEscape)}</b> امتیاز.</li>
        <li>جاسوس کلمه را درست حدس بزند: هر جاسوس <b>${fa(sc.spyGuessCorrect)}</b> امتیاز.</li>
        <li>پاداش رأی درست (به جاسوس واقعی): <b>${fa(sc.correctVoteBonus)}</b> امتیاز.</li>
      </ul>
      <h3>چند جاسوس</h3>
      <p>رأی‌گیری یک نفر را انتخاب می‌کند. اگر او جاسوس باشد، تیم عادی‌ها پیروز می‌شود مگر آنکه او کلمه را درست حدس بزند.</p>
      <h3>نکته‌ها</h3>
      <ul><li>جاسوس‌ها یکدیگر را نمی‌شناسند.</li><li>بعد از دیدن نقش، حتماً «متوجه شدم» را بزنید تا صفحه پاک شود.</li><li>دکمه بازگشت اندروید در طول بازی فقط پرسش خروج نشان می‌دهد.</li></ul>
    </div>
    <div class="foot"><button class="btn" data-act="back">بازگشت</button></div>`;
  };

  SCREENS.stats = () => {
    const s = state.stats;
    const pct = (a, b) => (b ? fa(Math.round((a / b) * 100)) + '٪' : '—');
    const rows = s.players.slice().sort((a, b) => b.wins - a.wins || b.points - a.points).map((p, i) =>
      `<div class="tr ${i === 0 && p.wins > 0 ? 'first' : ''}"><span class="rank">${fa(i + 1)}</span><span>${esc(p.name)}<br><span class="badge">${fa(p.wins)} برد از ${fa(p.games)} بازی</span></span><span></span><span class="pts">${fa(p.points)}</span></div>`).join('');
    return `${header('آمار و رکوردها', true, '')}
    <div class="body">
      <div class="tiles">
        <div class="tile"><b>${fa(s.games)}</b><span>بازی کامل</span></div>
        <div class="tile"><b>${fa(s.rounds)}</b><span>دور بازی‌شده</span></div>
        <div class="tile"><b>${pct(s.spyWins, s.rounds)}</b><span>برد جاسوس‌ها</span></div>
        <div class="tile"><b>${pct(s.normalWins, s.rounds)}</b><span>برد بازیکنان عادی</span></div>
      </div>
      <div class="sec-title">رکورد بازیکنان (امتیاز کل)</div>
      ${rows ? `<div class="group table">${rows}</div>` : '<div class="note info">هنوز بازی‌ای ثبت نشده است.</div>'}
    </div>
    <div class="foot"><button class="btn danger" data-act="resetStats">پاک کردن آمار</button></div>`;
  };

  SCREENS.settings = () => {
    const g = state.general, sc = g.scoring;
    const labels = { normalWinCatch: 'برد عادی‌ها (لو رفتن جاسوس)', spyEscape: 'جاسوس شناسایی نشد', spyGuessCorrect: 'حدس درست جاسوس', correctVoteBonus: 'پاداش رأی درست' };
    return `${header('تنظیمات', true, '')}
    <div class="body">
      <div class="group">
        ${toggleRow('sound', 'افکت‌های صوتی', '', g.sound, 'gtog')}
        ${toggleRow('vibration', 'لرزش', 'هنگام پایان زمان', g.vibration, 'gtog')}
        ${toggleRow('keepAwake', 'روشن ماندن صفحه', 'در طول بازی', g.keepAwake, 'gtog')}
      </div>
      <div class="sec-title">امتیازها</div>
      <div class="group">${Object.keys(labels).map((k) => `<div class="row"><div class="lbl">${labels[k]}</div>${stepper(k, sc[k], 'sstep')}</div>`).join('')}</div>
      <button class="btn ghost" data-act="resetScoring" style="margin-bottom:12px">بازگرداندن امتیازها به پیش‌فرض</button>
      <button class="btn danger" data-act="resetAll">پاک کردن همه اطلاعات ذخیره‌شده</button>
      <div class="center tag" style="margin-top:16px">جاسوس · نسخه ${fa(CONFIG.VERSION)}</div>
    </div>`;
  };

  /* ---------- رندر ---------- */
  function modalHtml() {
    const m = state.ui.modal;
    if (!m) return '';
    return `<div class="overlay"><div class="sheet"><h2>${esc(m.title)}</h2><p>${esc(m.text)}</p><div class="acts"><button class="btn ghost" data-act="mCancel">انصراف</button><button class="btn ${m.danger ? 'danger' : 'primary'}" data-act="mOk">${esc(m.ok || 'تأیید')}</button></div></div></div>`;
  }

  let lastScreen = null;
  function render(changed) {
    const prev = $app.querySelector('.body');
    const top = !changed && prev ? prev.scrollTop : 0;
    const secret = SECRET_SCREENS.includes(state.screen);
    $app.innerHTML = `<div class="screen ${changed && !secret ? 'enter' : ''}">${SCREENS[state.screen]()}</div>${modalHtml()}`;
    const b = $app.querySelector('.body');
    if (b && top) b.scrollTop = top;
    lastScreen = state.screen;
    if (state.screen === 'timer' && state.round.timer.state === 'running') startTick();
    if (state.ui.lockUntil > Date.now()) {
      const ms = state.ui.lockUntil - Date.now();
      $app.querySelectorAll('[data-lockable]').forEach((el) => el.classList.add('disabled'));
      setTimeout(() => $app.querySelectorAll('[data-lockable]').forEach((el) => el.classList.remove('disabled')), ms + 20);
    }
  }

  function go(screen) {
    state.screen = screen;
    state.ui.error = '';
    if (screen !== 'timer') stopTick();
    Native.secure(SECRET_SCREENS.includes(screen));
    Native.keepAwake(!!state.game && state.general.keepAwake);
    render(true);
  }

  /* ---------- زمان‌سنج ---------- */
  let tickId = null;
  function stopTick() { if (tickId) { clearInterval(tickId); tickId = null; } }
  function startTick() { stopTick(); tickId = setInterval(tick, 250); }
  function paintTimer(rem) {
    const t = state.round.timer;
    const txt = document.getElementById('t-text');
    const fg = document.getElementById('ring-fg');
    const wrap = document.getElementById('ring-wrap');
    if (txt) txt.textContent = fmt(rem);
    if (fg) fg.setAttribute('stroke-dashoffset', (RING * (1 - rem / t.total)).toFixed(2));
    if (wrap) wrap.classList.toggle('warn', rem <= 10000);
  }
  function tick() {
    const r = state.round;
    if (!r || state.screen !== 'timer' || !r.timer || r.timer.state !== 'running') { stopTick(); return; }
    const rem = remainingMs(r.timer);
    paintTimer(rem);
    if (rem <= 0) { timerUp(); return; }
    const sec = Math.ceil(rem / 1000);
    if (sec <= 5 && sec !== r.timer.lastBeep) { r.timer.lastBeep = sec; Audio.play('tick'); }
  }
  function timerUp() {
    const t = state.round.timer;
    t.state = 'up'; t.remaining = 0;
    stopTick();
    Audio.play('alarm'); Audio.buzz(600);
    render(false);
  }

  /* ---------- روند بازی ---------- */
  function startGame() {
    const s = state.setup;
    const errs = G.validateSetup(s, BANK);
    if (errs.length) { state.ui.error = errs[0]; go('setup'); return; }
    const clean = G.cleanNames(s.names, s.playerCount);
    if (clean.error) { state.ui.error = clean.error; render(false); return; }
    saveSetup();
    const players = clean.names.map((name, i) => ({ id: 'p' + i, name }));
    beginGame(players, JSON.parse(JSON.stringify(s)));
  }
  function beginGame(players, settings) {
    state.game = { players, settings, roundNo: 0, totals: {}, history: [], recorded: false };
    players.forEach((p) => { state.game.totals[p.id] = 0; });
    startRound();
  }
  function startRound() {
    const g = state.game;
    g.roundNo++;
    const pick = G.pickWord({ catIds: g.settings.categories, bank: BANK, used: state.used, mixRandom: g.settings.mixRandom });
    const base = G.createRound({ players: g.players, spyCount: g.settings.spyCount, word: pick.word, catId: pick.catId });
    state.round = Object.assign(base, {
      revealIndex: 0, revealShown: false,
      timer: { state: 'ready', total: g.settings.timeMinutes * 60000, remaining: g.settings.timeMinutes * 60000, endAt: 0, lastBeep: 0 },
      votes: {}, voteIdx: 0, voteSel: null, candidates: g.players.map((p) => p.id), tieCount: 0,
      lastTally: null, decision: null, accusedId: null, guessOptions: [], guessText: '', guess: null, outcome: null, result: null,
    });
    go('reveal');
  }
  function finishRound(outcome) {
    const g = state.game, r = state.round;
    r.outcome = outcome;
    r.result = G.scoreRound({ players: g.players, spyIds: r.spyIds, outcome, votes: r.votes, scoring: state.general.scoring });
    g.players.forEach((p) => { g.totals[p.id] += r.result.deltas[p.id]; });
    g.history.push({ no: g.roundNo, outcome, side: r.result.side, deltas: r.result.deltas });
    G.recordRound(state.stats, { players: g.players, spyIds: r.spyIds, deltas: r.result.deltas, side: r.result.side, outcome });
    saveStats();
    Audio.play(r.result.side === 'normal' ? 'success' : 'fail');
    go('result');
  }
  function endGame() {
    stopTick();
    state.game = null; state.round = null;
    go('home');
  }
  function askExit() {
    if (state.screen === 'reveal' && state.round) state.round.revealShown = false;
    openModal({ title: 'لغو بازی؟', text: 'بازی فعلی لغو می‌شود و به منوی اصلی برمی‌گردی.', ok: 'لغو بازی', danger: true, onOk: endGame });
  }
  function openModal(m) { state.ui.modal = m; render(false); }
  function closeModal() { state.ui.modal = null; render(false); }
  function lock(ms) { state.ui.lockUntil = Date.now() + ms; }

  /* ---------- اکشن‌ها ---------- */
  const ACTIONS = {
    go: (d) => go(d.to),
    back: () => window.__spyBack(),
    newGame: () => { state.setup = loadSetup(); go('setup'); },

    step: (d) => {
      const s = state.setup, delta = int(d.d, 0);
      state.ui.error = '';
      if (d.key === 'playerCount') {
        const n = s.playerCount + delta;
        if (n < L.minPlayers) state.ui.error = `حداقل ${fa(L.minPlayers)} بازیکن لازم است.`;
        else if (n > L.maxPlayers) state.ui.error = `حداکثر ${fa(L.maxPlayers)} بازیکن مجاز است.`;
        else {
          s.playerCount = n;
          const max = G.maxSpies(n);
          if (s.spyCount > max) { s.spyCount = max; state.ui.error = `تعداد جاسوس‌ها به ${fa(max)} کاهش یافت (حداکثر برای ${fa(n)} بازیکن).`; }
        }
      } else if (d.key === 'spyCount') {
        const n = s.spyCount + delta, max = G.maxSpies(s.playerCount);
        if (n < 1) state.ui.error = 'حداقل یک جاسوس لازم است.';
        else if (n > max) state.ui.error = `برای ${fa(s.playerCount)} بازیکن حداکثر ${fa(max)} جاسوس مجاز است.`;
        else s.spyCount = n;
      } else if (d.key === 'rounds') {
        const n = s.rounds + delta;
        if (n < L.minRounds) state.ui.error = `حداقل ${fa(L.minRounds)} دور لازم است.`;
        else if (n > L.maxRounds) state.ui.error = `حداکثر ${fa(L.maxRounds)} دور مجاز است.`;
        else s.rounds = n;
      }
      saveSetup(); render(false);
    },
    time: (d) => { state.setup.timeMinutes = int(d.v, 5); saveSetup(); render(false); },
    tog: (d) => { state.setup[d.key] = !state.setup[d.key]; saveSetup(); render(false); },
    seg: (d) => { state.setup[d.key] = d.v; saveSetup(); render(false); },
    toCats: () => {
      const errs = G.validateSetup(state.setup, BANK).filter((e) => !e.includes('دسته'));
      if (errs.length) { state.ui.error = errs[0]; render(false); return; }
      go('cats');
    },
    catToggle: (d) => {
      const sel = state.setup.categories, i = sel.indexOf(d.id);
      if (i >= 0) sel.splice(i, 1); else sel.push(d.id);
      state.ui.error = ''; saveSetup(); render(false);
    },
    catAll: () => { state.setup.categories = BANK.map((c) => c.id); state.ui.error = ''; saveSetup(); render(false); },
    catNone: () => { state.setup.categories = []; saveSetup(); render(false); },
    toNames: () => {
      if (!state.setup.categories.length) { state.ui.error = 'حداقل یک دسته‌بندی را انتخاب کنید.'; render(false); return; }
      go('names');
    },
    startGame,

    reveal: () => { state.round.revealShown = true; Audio.play('reveal'); render(false); },
    understood: () => {
      const r = state.round, g = state.game;
      r.revealShown = false;
      r.revealIndex++;
      if (r.revealIndex >= g.players.length) { r.revealIndex = g.players.length - 1; go('timer'); }
      else { lock(900); render(true); } // قفل کوتاه: لمس دوباره نقش نفر بعد را نشان ندهد
    },

    tstart: () => { const t = state.round.timer; t.state = 'running'; t.endAt = Date.now() + t.remaining; render(false); },
    tpause: () => { const t = state.round.timer; t.remaining = remainingMs(t); t.state = 'paused'; stopTick(); render(false); },
    tresume: () => { const t = state.round.timer; t.state = 'running'; t.endAt = Date.now() + t.remaining; render(false); },
    tvote: () => { stopTick(); state.round.voteIdx = 0; state.round.voteSel = null; go('vote'); },
    tabort: () => openModal({ title: 'پایان زودهنگام دور؟', text: 'دور بدون امتیاز تمام می‌شود و نقش‌ها اعلام می‌شوند.', ok: 'پایان دور', danger: true, onOk: () => { closeModal(); stopTick(); finishRound('aborted'); } }),
    timeoutWin: () => finishRound('timeout-escape'),

    vpick: (d) => { state.round.voteSel = d.id; render(false); },
    vsubmit: () => {
      const r = state.round, g = state.game;
      if (!r.voteSel) return;
      r.votes[g.players[r.voteIdx].id] = r.voteSel;
      r.voteSel = null; r.voteIdx++;
      if (r.voteIdx >= g.players.length) {
        r.lastTally = G.tally(r.votes, r.candidates);
        r.decision = G.resolveVote(r.lastTally, g.settings, r.tieCount);
        go('voteResult');
      } else { lock(600); render(true); }
    },
    vcontinue: () => {
      const r = state.round, g = state.game, d = r.decision;
      if (d.status === 'revote') {
        r.tieCount++; r.candidates = d.tied; r.votes = {}; r.voteIdx = 0; r.voteSel = null;
        go('vote');
      } else if (d.status === 'tie-final') {
        finishRound('tie-escape');
      } else {
        r.accusedId = d.accusedId;
        if (!r.spyIds.includes(d.accusedId)) finishRound('spy-escaped');
        else if (g.settings.spyGuess) {
          r.guessOptions = G.guessOptions({ word: r.word, bank: BANK, catIds: g.settings.categories, count: CONFIG.GUESS_OPTION_COUNT });
          r.guessText = '';
          go('guess');
        } else finishRound('spy-caught');
      }
    },

    gpick: (d) => { state.round.guessText = d.w; render(false); },
    gsubmit: () => {
      const r = state.round;
      if (!G.normalize(r.guessText)) return;
      const ok = G.guessMatches(r.guessText, r.word);
      r.guess = { text: r.guessText.trim(), correct: ok };
      finishRound(ok ? 'spy-guessed' : 'spy-caught');
    },
    gskip: () => finishRound('spy-caught'),

    toScores: () => go('scores'),
    nextRound: startRound,
    toFinal: () => {
      const g = state.game;
      if (!g.recorded) { g.recorded = true; G.recordGame(state.stats, { players: g.players, totals: g.totals }); saveStats(); Audio.play('success'); }
      go('final');
    },
    again: () => beginGame(state.game.players, state.game.settings),
    endGame,

    gtog: (d) => { state.general[d.key] = !state.general[d.key]; saveGeneral(); applyGeneral(); render(false); },
    sstep: (d) => {
      const sc = state.general.scoring, R = CONFIG.SCORING_RANGE;
      sc[d.key] = G.clamp(sc[d.key] + int(d.d, 0), R.min, R.max);
      saveGeneral(); render(false);
    },
    resetScoring: () => { state.general.scoring = Object.assign({}, CONFIG.DEFAULT_SCORING); saveGeneral(); render(false); toast('امتیازها به پیش‌فرض برگشت'); },
    resetStats: () => openModal({ title: 'پاک کردن آمار؟', text: 'همه رکوردها و آمار بازی‌ها پاک می‌شود.', ok: 'پاک کن', danger: true, onOk: () => { state.stats = G.emptyStats(); saveStats(); closeModal(); } }),
    resetAll: () => openModal({ title: 'پاک کردن همه اطلاعات؟', text: 'تنظیمات، نام‌ها، امتیازها و آمار به حالت اولیه برمی‌گردد.', ok: 'پاک کن', danger: true, onOk: () => {
      ['settings', 'general', 'stats'].forEach((k) => Storage.remove(k));
      state.setup = loadSetup(); state.general = loadGeneral(); state.stats = G.emptyStats(); applyGeneral(); closeModal();
    } }),

    mCancel: closeModal,
    mOk: () => { const m = state.ui.modal; state.ui.modal = null; if (m && m.onOk) m.onOk(); else render(false); },
  };

  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.classList.contains('disabled')) return;
    if (Date.now() < state.ui.lockUntil) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    Audio.play('click');
    fn(el.dataset, el);
  });

  $app.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.input === 'name') {
      state.setup.names[int(el.dataset.i, 0)] = el.value;
      saveSetup();
    } else if (el.dataset.input === 'guess' && state.round) {
      state.round.guessText = el.value;
      const btn = $app.querySelector('[data-act="gsubmit"]');
      if (btn) btn.classList.toggle('disabled', !G.normalize(el.value));
    }
  });

  /* ---------- دکمه بازگشت اندروید ---------- */
  window.__spyBack = function () {
    if (state.ui.modal) { closeModal(); return true; }
    switch (state.screen) {
      case 'home': return false;
      case 'help': case 'stats': case 'settings': case 'setup': go('home'); return true;
      case 'cats': go('setup'); return true;
      case 'names': go('cats'); return true;
      case 'final': endGame(); return true;
      default: askExit(); return true;
    }
  };

  /* ---------- امنیت: با رفتن برنامه به پس‌زمینه، نقش نمایش‌داده‌شده پاک می‌شود ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'reveal' && state.round && state.round.revealShown) {
      state.round.revealShown = false;
      render(false);
    }
  });

  Native.secure(false);
  Native.keepAwake(false);
  render(true);
})();
