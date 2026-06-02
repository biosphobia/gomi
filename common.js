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
    ja: { brand: '🏯 大阪サポート', navHome: 'ホーム', navGame: 'ごみゲーム', navVideos: '動画' },
    en: { brand: '🏯 Osaka Support', navHome: 'Home', navGame: 'Trash Game', navVideos: 'Videos' },
    zh: { brand: '🏯 大阪支援',     navHome: '首页', navGame: '垃圾游戏', navVideos: '视频' },
    ko: { brand: '🏯 오사카 서포트', navHome: '홈',   navGame: '쓰레기 게임', navVideos: '동영상' },
    my: { brand: '🏯 အိုဆာကာ အကူအညီ', navHome: 'ပင်မ', navGame: 'အမှိုက်ဂိမ်း', navVideos: 'ဗီဒီယို' },
    vi: { brand: '🏯 Hỗ trợ Osaka',   navHome: 'Trang chủ', navGame: 'Trò chơi rác', navVideos: 'Video' },
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

  // ---------- Public API ----------
  window.LANGS = LANGS;
  window.getLang = getLang;
  window.setLang = setLang;
  window.applySiteHeader = applySiteHeader;
  window.setupLangToggle = setupLangToggle;
  window.VideoDB = VideoDB;
})();
