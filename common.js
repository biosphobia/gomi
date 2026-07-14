/* ============================================================
   エールお助け隊 — shared client JS
   Exposes globals: LANGS, getLang, setLang, applySiteHeader,
   setupLangToggle, VideoDB.
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'osaka_gomi_lang';

  // ---------- Languages ----------
  const LANGS = [
    { code: 'ja', name: '日本語' },
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文' },
    { code: 'ko', name: '한국어' },
    { code: 'my', name: 'မြန်မာ' },
    { code: 'vi', name: 'Tiếng Việt' },
  ];

  function getLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && LANGS.some(l => l.code === v)) return v;
    } catch (_) {}
    return 'ja';
  }
  function setLang(code) {
    if (!LANGS.some(l => l.code === code)) return;
    try { localStorage.setItem(STORAGE_KEY, code); } catch (_) {}
  }

  // ---------- Site-wide header strings ----------
  const SITE_I18N = {
    ja: { brand: 'エールお助け隊', navHome: 'ホーム', navDaily: '生活', navGames: 'ゲーム' },
    en: { brand: 'エールお助け隊', navHome: 'Home', navDaily: 'Daily Life', navGames: 'Games' },
    zh: { brand: 'エールお助け隊',     navHome: '首页', navDaily: '日常生活', navGames: '游戏' },
    ko: { brand: 'エールお助け隊', navHome: '홈',   navDaily: '생활', navGames: '게임' },
    my: { brand: 'エールお助け隊', navHome: 'ပင်မ', navDaily: 'နေ့စဉ်ဘဝ', navGames: 'ဂိမ်းများ' },
    vi: { brand: 'エールお助け隊',   navHome: 'Trang chủ', navDaily: 'Đời sống', navGames: 'Trò chơi' },
  };

  // ---------- Header rendering ----------
  function applySiteHeader(currentPage) {
    const lang = getLang();
    const L = SITE_I18N[lang] || SITE_I18N.ja;
    document.documentElement.lang = lang;

    // Brand text sits in .site-brand-text (next to the logo image).
    // Fall back to the whole .site-brand if the span isn't present.
    const brandText = document.querySelector('.site-brand-text');
    if (brandText) brandText.textContent = L.brand;
    else {
      const brand = document.querySelector('.site-brand');
      if (brand) brand.textContent = L.brand;
    }

    document.querySelectorAll('[data-nav]').forEach(el => {
      const key = 'nav' + el.dataset.nav.charAt(0).toUpperCase() + el.dataset.nav.slice(1);
      if (L[key]) el.textContent = L[key];
    });

    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === currentPage);
    });

    const toggle = document.querySelector('.site-lang-toggle');
    if (toggle) {
      const cur = LANGS.find(l => l.code === lang);
      toggle.textContent = '🌐 ' + (cur ? cur.name : lang);
      toggle.classList.toggle('lang-my', lang === 'my');
    }
  }

  // ---------- Language picker dropdown ----------
  function showLangMenu(anchor, onChange) {
    const existing = document.querySelector('.lang-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.className = 'lang-menu';
    const curLang = getLang();
    for (const lang of LANGS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'lang-menu-item' + (lang.code === curLang ? ' active' : '');
      item.textContent = lang.name;
      if (lang.code === 'my') item.classList.add('lang-my');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setLang(lang.code);
        menu.remove();
        if (onChange) onChange(lang.code);
      });
      menu.appendChild(item);
    }
    document.body.appendChild(menu);

    const r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';

    const close = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  }

  function setupLangToggle(onChange) {
    const btn = document.querySelector('.site-lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showLangMenu(btn, onChange);
    });
  }

  // ---------- Video DB (IndexedDB) ----------
  const DB_NAME = 'osaka_support';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('videos')) {
          const s = db.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('lang', 'lang', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const VideoDB = {
    async add(lang, file) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('videos', 'readwrite');
        const req = tx.objectStore('videos').add({
          lang,
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file,
          uploadedAt: Date.now(),
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async list(lang) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('videos', 'readonly');
        const idx = tx.objectStore('videos').index('lang');
        const req = idx.getAll(lang);
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.uploadedAt - a.uploadedAt));
        req.onerror = () => reject(req.error);
      });
    },
    async delete(id) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('videos', 'readwrite');
        tx.objectStore('videos').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };

  // ============================================================
  // Reaction popups (maru / batsu image + sound) for the games.
  // ============================================================
  //
  // ┌─────────────────────────────────────────────────────────┐
  // │ EDIT HERE to add more reaction images.                    │
  // │ Drop image files under images/reactions/correct/ or       │
  // │ images/reactions/wrong/ and add their paths below. One    │
  // │ is picked at random each time. Transparent PNG looks best │
  // │ but JPG works too — just match the path.                  │
  // └─────────────────────────────────────────────────────────┘
  const REACTION_IMAGES = {
    correct: [
      'images/reactions/correct/maru1.png',
      'images/reactions/correct/maru2.png',
    ],
    wrong: [
      'images/reactions/wrong/batsu1.png',
      'images/reactions/wrong/batsu2.png',
    ],
  };

  // ---------- Reaction sound (Web Audio, no files needed) ----------
  let reactionAudioCtx = null;
  function reactionCtx() {
    try {
      if (!reactionAudioCtx) reactionAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (reactionAudioCtx.state === 'suspended') reactionAudioCtx.resume().catch(() => {});
    } catch (_) {}
    return reactionAudioCtx;
  }
  function tone(ctx, freq, start, dur, type, peak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak || 0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function playReactionSound(outcome) {
    const ctx = reactionCtx();
    if (!ctx) return;
    if (outcome === 'correct') {
      // bright two-note ping
      tone(ctx, 880, 0, 0.32, 'sine', 0.2);
      tone(ctx, 1320, 0.05, 0.32, 'sine', 0.16);
    } else {
      // descending "du dunn" buzzer
      tone(ctx, 196, 0, 0.22, 'triangle', 0.22);
      tone(ctx, 130, 0.18, 0.42, 'triangle', 0.24);
    }
  }

  // ---------- Reaction image popup ----------
  // outcome: 'correct' | 'wrong'
  // busyRects: optional array of DOMRect-likes to avoid (game content).
  function showReaction(outcome, busyRects) {
    playReactionSound(outcome);
    const imgs = REACTION_IMAGES[outcome] || [];
    if (!imgs.length) return;
    const src = imgs[(Math.random() * imgs.length) | 0];

    const vw = window.innerWidth, vh = window.innerHeight;
    const size = Math.max(140, Math.min(300, Math.round(Math.min(vw, vh) * 0.34)));
    const inset = 10;
    // Keep below the sticky 56px site header on every page.
    const topPad = 66;
    const avoid = busyRects || [];
    const minX = inset, maxX = vw - size - inset;
    const minY = topPad, maxY = vh - size - inset;
    const overlaps = (x, y) => {
      const r = { left: x, top: y, right: x + size, bottom: y + size };
      return avoid.some(b => !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom));
    };
    // Try fully random positions across the viewport; fall back to the
    // top-left if every attempt overlaps a busy rect.
    let px = minX, py = minY;
    for (let i = 0; i < 40; i++) {
      const x = minX + Math.random() * Math.max(1, maxX - minX);
      const y = minY + Math.random() * Math.max(1, maxY - minY);
      if (!overlaps(x, y)) { px = x; py = y; break; }
    }

    const el = document.createElement('img');
    el.className = 'reaction-pop ' + outcome;
    el.src = src;
    el.alt = '';
    el.onerror = () => el.remove();
    // Square bounding box + object-fit:contain (from styles.css) so
    // every image occupies the same on-screen footprint regardless of
    // its native aspect ratio.
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left = Math.round(px) + 'px';
    el.style.top  = Math.round(py) + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => el.remove(), 340);
    }, 1000);
  }

  // ============================================================
  // Versus picture-code (shared by the games-page setup panel and
  // the game-page lobby). A lobby code is a sequence of VS_CODE_LEN
  // Osaka pictures; each picture maps to a letter so Firestore doc
  // ids stay plain strings (e.g. "TCUK").
  // ============================================================
  const VS_SYMBOLS = [
    { key: 'T', img: 'images/code/takoyaki.svg',   alt: 'たこ焼き' },
    { key: 'C', img: 'images/code/castle.svg',     alt: '大阪城' },
    { key: 'U', img: 'images/code/umeda.svg',      alt: '梅田スカイビル' },
    { key: 'K', img: 'images/code/tsutenkaku.svg', alt: '通天閣' },
  ];
  const VS_CODE_LEN = 4;
  const vsSymbolByKey = (k) => VS_SYMBOLS.find(s => s.key === k);

  function vsCodeImgsHtml(code) {
    return String(code || '').split('').map(ch => {
      const sym = vsSymbolByKey(ch);
      return sym ? `<img src="${sym.img}" alt="${sym.alt}" />` : '';
    }).join('');
  }

  // Builds a picture keypad into padEl and its entry display into
  // slotsEl. onChange(code) fires on every change. Returns
  // { value(), reset() }.
  function buildVsKeypad(padEl, slotsEl, onChange) {
    let entry = [];
    function render() {
      slotsEl.innerHTML = '';
      for (let i = 0; i < VS_CODE_LEN; i++) {
        const cell = document.createElement('div');
        cell.className = 'vs-code-slot' + (entry[i] ? ' filled' : '');
        if (entry[i]) {
          const sym = vsSymbolByKey(entry[i]);
          cell.innerHTML = `<img src="${sym.img}" alt="${sym.alt}" />`;
        } else {
          cell.textContent = '·';
        }
        slotsEl.appendChild(cell);
      }
      if (onChange) onChange(entry.join(''));
    }
    padEl.innerHTML = '';
    for (const sym of VS_SYMBOLS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vs-key';
      b.innerHTML = `<img src="${sym.img}" alt="${sym.alt}" />`;
      b.addEventListener('click', () => {
        if (entry.length >= VS_CODE_LEN) return;
        entry.push(sym.key);
        render();
      });
      padEl.appendChild(b);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'vs-key vs-key-del';
    del.textContent = '⌫';
    del.addEventListener('click', () => { entry.pop(); render(); });
    padEl.appendChild(del);
    render();
    return {
      value: () => entry.join(''),
      reset: () => { entry = []; render(); },
    };
  }

  // ============================================================
  // High scores + grades (bronze / silver / gold / jouzu).
  // Best single-run result per game, kept in localStorage.
  // Reaching a grade unlocks cosmetics (maru/batsu sounds, images,
  // …) — all still 準備中, so the rewards list is display-only.
  //   gomi: best final score        kana: most correct in one run
  // ============================================================
  const GRADE_KEYS = ['bronze', 'silver', 'gold', 'jouzu'];
  const GRADE_ICONS = { bronze: '🥉', silver: '🥈', gold: '🥇', jouzu: '👑' };
  const GRADE_THRESHOLDS = {
    gomi: [900, 1800, 3000, 5000],
    kana: [20, 50, 100, 150],
  };

  const GRADES_I18N = {
    ja: { highScore: 'ハイスコア', newRecord: '🎉 新記録！', rewards: 'ごほうび', soon: '準備中',
      grades: { bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', jouzu: '上手' },
      rewardNames: { bronze: '◯✕のあたらしい音', silver: '◯✕のあたらしい絵', gold: 'スペシャルテーマ', jouzu: 'ひみつのごほうび' } },
    en: { highScore: 'High score', newRecord: '🎉 New record!', rewards: 'Rewards', soon: 'Coming soon',
      grades: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', jouzu: 'Jouzu' },
      rewardNames: { bronze: 'New maru/batsu sounds', silver: 'New maru/batsu images', gold: 'Special theme', jouzu: 'Secret reward' } },
    zh: { highScore: '最高分', newRecord: '🎉 新纪录！', rewards: '奖励', soon: '敬请期待',
      grades: { bronze: '铜牌', silver: '银牌', gold: '金牌', jouzu: '上手' },
      rewardNames: { bronze: '新的◯✕音效', silver: '新的◯✕图片', gold: '特别主题', jouzu: '神秘奖励' } },
    ko: { highScore: '최고 기록', newRecord: '🎉 신기록!', rewards: '보상', soon: '준비 중',
      grades: { bronze: '브론즈', silver: '실버', gold: '골드', jouzu: 'Jouzu' },
      rewardNames: { bronze: '새로운 ◯✕ 효과음', silver: '새로운 ◯✕ 이미지', gold: '스페셜 테마', jouzu: '비밀 보상' } },
    my: { highScore: 'အမြင့်ဆုံးမှတ်', newRecord: '🎉 စံချိန်သစ်!', rewards: 'ဆုလာဘ်', soon: 'ပြင်ဆင်ဆဲ',
      grades: { bronze: 'ကြေးတံဆိပ်', silver: 'ငွေတံဆိပ်', gold: 'ရွှေတံဆိပ်', jouzu: 'Jouzu' },
      rewardNames: { bronze: '◯✕ အသံအသစ်', silver: '◯✕ ပုံအသစ်', gold: 'အထူးအပြင်အဆင်', jouzu: 'လျှို့ဝှက်ဆု' } },
    vi: { highScore: 'Điểm cao nhất', newRecord: '🎉 Kỷ lục mới!', rewards: 'Phần thưởng', soon: 'Sắp có',
      grades: { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', jouzu: 'Jouzu' },
      rewardNames: { bronze: 'Âm thanh ◯✕ mới', silver: 'Hình ◯✕ mới', gold: 'Chủ đề đặc biệt', jouzu: 'Phần thưởng bí mật' } },
  };

  function gradesTexts() { return GRADES_I18N[getLang()] || GRADES_I18N.ja; }

  function gradeFor(game, score) {
    const th = GRADE_THRESHOLDS[game] || [];
    let grade = null;
    for (let i = 0; i < th.length; i++) if (score >= th[i]) grade = GRADE_KEYS[i];
    return grade;
  }

  function gradesGet(game) {
    let best = 0;
    try { best = parseInt(localStorage.getItem('osaka_hiscore_' + game), 10) || 0; } catch (_) {}
    return { best, grade: gradeFor(game, best) };
  }

  function gradesSubmit(game, score) {
    const prev = gradesGet(game);
    const s = Math.max(0, score | 0);
    const isNewBest = s > prev.best;
    const best = isNewBest ? s : prev.best;
    if (isNewBest) {
      try { localStorage.setItem('osaka_hiscore_' + game, String(best)); } catch (_) {}
    }
    const grade = gradeFor(game, best);
    return { best, grade, isNewBest, isNewGrade: isNewBest && grade !== prev.grade };
  }

  // "ハイスコア: 3,200 🥇 ゴールド" (or "ハイスコア: —" before any run)
  function gradeBadgeHtml(game) {
    const t = gradesTexts();
    const { best, grade } = gradesGet(game);
    if (!best) return `${t.highScore}: <b>—</b>`;
    const g = grade
      ? ` <span class="grade-chip grade-${grade}">${GRADE_ICONS[grade]} ${t.grades[grade]}</span>`
      : '';
    return `${t.highScore}: <b>${best.toLocaleString()}</b>${g}`;
  }

  // Compact rewards list: one cosmetic slot per grade, unlocked by the
  // player's current grade, everything tagged 準備中 for now.
  function renderRewards(container, game) {
    const t = gradesTexts();
    const { grade } = gradesGet(game);
    const reached = grade ? GRADE_KEYS.indexOf(grade) : -1;
    const th = GRADE_THRESHOLDS[game] || [];
    container.innerHTML = GRADE_KEYS.map((key, i) => {
      const unlocked = i <= reached;
      return `<div class="reward-row${unlocked ? '' : ' locked'}">
        <span class="grade-chip grade-${key}">${GRADE_ICONS[key]} ${t.grades[key]}</span>
        <span class="reward-req">${(th[i] || 0).toLocaleString()}</span>
        <span class="reward-name">${unlocked ? '' : '🔒 '}${t.rewardNames[key]}</span>
        <span class="reward-soon">${t.soon}</span>
      </div>`;
    }).join('');
  }

  const Grades = {
    get: gradesGet,
    submit: gradesSubmit,
    badgeHtml: gradeBadgeHtml,
    renderRewards,
    texts: gradesTexts,
  };

  // ---------- Public API ----------
  window.Grades = Grades;
  window.LANGS = LANGS;
  window.getLang = getLang;
  window.setLang = setLang;
  window.applySiteHeader = applySiteHeader;
  window.setupLangToggle = setupLangToggle;
  window.VideoDB = VideoDB;
  window.VS_SYMBOLS = VS_SYMBOLS;
  window.VS_CODE_LEN = VS_CODE_LEN;
  window.vsCodeImgsHtml = vsCodeImgsHtml;
  window.buildVsKeypad = buildVsKeypad;
  window.REACTION_IMAGES = REACTION_IMAGES;
  window.playReactionSound = playReactionSound;
  window.showReaction = showReaction;
})();
