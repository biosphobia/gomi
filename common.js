/* ============================================================
   Osaka Support — shared client JS
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
    ja: { brand: '🏯 大阪サポート', navHome: 'ホーム', navGame: 'ごみゲーム', navKana: 'かなクイズ', navVideos: '動画', navContact: '相談チャット' },
    en: { brand: '🏯 Osaka Support', navHome: 'Home', navGame: 'Trash Game', navKana: 'Kana Quiz', navVideos: 'Videos', navContact: 'Contact' },
    zh: { brand: '🏯 大阪支援',     navHome: '首页', navGame: '垃圾游戏', navKana: '假名测验', navVideos: '视频', navContact: '咨询' },
    ko: { brand: '🏯 오사카 서포트', navHome: '홈',   navGame: '쓰레기 게임', navKana: '가나 퀴즈', navVideos: '동영상', navContact: '상담' },
    my: { brand: '🏯 အိုဆာကာ အကူအညီ', navHome: 'ပင်မ', navGame: 'အမှိုက်ဂိမ်း', navKana: 'ကာနာ ပဟေဠိ', navVideos: 'ဗီဒီယို', navContact: 'ဆက်သွယ်ရန်' },
    vi: { brand: '🏯 Hỗ trợ Osaka',   navHome: 'Trang chủ', navGame: 'Trò chơi rác', navKana: 'Trắc nghiệm Kana', navVideos: 'Video', navContact: 'Liên hệ' },
  };

  // ---------- Header rendering ----------
  function applySiteHeader(currentPage) {
    const lang = getLang();
    const L = SITE_I18N[lang] || SITE_I18N.ja;
    document.documentElement.lang = lang;

    const brand = document.querySelector('.site-brand');
    if (brand) brand.textContent = L.brand;

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

  // ---------- Public API ----------
  window.LANGS = LANGS;
  window.getLang = getLang;
  window.setLang = setLang;
  window.applySiteHeader = applySiteHeader;
  window.setupLangToggle = setupLangToggle;
  window.VideoDB = VideoDB;
  window.REACTION_IMAGES = REACTION_IMAGES;
  window.playReactionSound = playReactionSound;
  window.showReaction = showReaction;
})();
