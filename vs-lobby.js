/* ============================================================
   vs-lobby.js — shared 2-player lobby over Firebase Firestore.

   Used by game.html (trash game) and kana.html (kana quiz). Each
   page includes this after common.js and its own game script, adds
   the #lobbyOverlay markup, defines window.GAME with
   startVersus(hooks) / reportOpponent(opp) / setVersusResult(...),
   then calls VsLobby.boot(config).

   Players arrive with URL params set by the games-page setup panel:
     ?vs=create&name=X            create a lobby, wait for a guest
     ?vs=join&code=TCUK&name=X    join that lobby

   Lobby docs live in one Firestore collection ('lobbies'); a `game`
   tag on the doc keeps the two games' codes from colliding (docs
   without a tag are treated as the trash game's, which predates it).

   config = {
     game:         'gomi' | 'kana' — doc tag, must match to join
     returnUrl:    where the back button / rematch goes
     initialStats: () => per-player stat fields (reset each match)
     compare:      (me, opp) => 'win' | 'lose' | 'draw'
     resultSub:    (me, opp, t) => score-line string for the result
     deferCreate:  if true, ?vs=create does NOT create the lobby right
                   away - the page shows its own setup UI first, then
                   calls the returned api.createNow(extraDoc), whose
                   fields (e.g. quiz settings) are merged into the
                   lobby doc so the guest can read them
   }

   boot() returns { createNow(extraDoc) } (only useful with
   deferCreate). GAME.startVersus(hooks, lobbyDoc) receives the lobby
   doc, so pages can apply host-chosen settings from it.

   The hooks object passed to GAME.startVersus:
     onStats(patch)  — merge stat fields into my player doc
     onEnd(patch)    — final stats; must include finished: true
     onRestart()     — leave the lobby and return to the games page
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const isReal = (v) => typeof v === 'string' && v.trim() && !v.startsWith('@@');

  // ---- i18n ----
  const VS = {
    ja: { title:'🆚 たいせん', codeLabel:'合言葉', start:'スタート',
      waitHost:'ホストの開始を待っています…', back:'← もどる', host:'ホスト', guest:'ゲスト', empty:'（空き）',
      you:'あなた', opp:'あいて', unavailable:'※ 対戦にはFirebaseの設定が必要です。シングルプレイは設定なしで遊べます。',
      errFull:'このロビーは満員です。', errNotFound:'ロビーが見つかりません。',
      errGeneric:'接続に失敗しました。', connecting:'接続中…', waitOpp:'相手の結果を待っています…',
      win:'🏆 勝ち！', lose:'😢 負け…', draw:'🤝 引き分け' },
    en: { title:'🆚 Versus', codeLabel:'Code', start:'Start',
      waitHost:'Waiting for the host to start…', back:'← Back', host:'Host', guest:'Guest', empty:'(empty)',
      you:'You', opp:'Opp', unavailable:'※ Versus needs Firebase configured. Single-player works without it.',
      errFull:'That lobby is full.', errNotFound:'Lobby not found.',
      errGeneric:'Connection failed.', connecting:'Connecting…', waitOpp:'Waiting for your opponent to finish…',
      win:'🏆 You win!', lose:'😢 You lose…', draw:'🤝 Draw' },
    zh: { title:'🆚 对战', codeLabel:'口令', start:'开始',
      waitHost:'等待房主开始…', back:'← 返回', host:'房主', guest:'客人', empty:'（空）',
      you:'你', opp:'对手', unavailable:'※ 对战需要配置 Firebase。单人模式无需配置即可游玩。',
      errFull:'房间已满。', errNotFound:'找不到房间。',
      errGeneric:'连接失败。', connecting:'连接中…', waitOpp:'等待对手完成…',
      win:'🏆 你赢了！', lose:'😢 你输了…', draw:'🤝 平局' },
    ko: { title:'🆚 대전', codeLabel:'코드', start:'시작',
      waitHost:'호스트의 시작을 기다리는 중…', back:'← 뒤로', host:'호스트', guest:'게스트', empty:'(빈자리)',
      you:'나', opp:'상대', unavailable:'※ 대전에는 Firebase 설정이 필요합니다. 싱글플레이는 설정 없이 가능합니다.',
      errFull:'로비가 가득 찼습니다.', errNotFound:'로비를 찾을 수 없습니다.',
      errGeneric:'연결에 실패했습니다.', connecting:'연결 중…', waitOpp:'상대가 끝나기를 기다리는 중…',
      win:'🏆 승리!', lose:'😢 패배…', draw:'🤝 무승부' },
    my: { title:'🆚 ပြိုင်ပွဲ', codeLabel:'ကုဒ်', start:'စတင်ပါ',
      waitHost:'ဟို့စ်စတင်ရန် စောင့်နေသည်…', back:'← နောက်သို့', host:'ဟို့စ်', guest:'ဧည့်သည်', empty:'(လွတ်)',
      you:'သင်', opp:'ပြိုင်ဘက်', unavailable:'※ ပြိုင်ပွဲအတွက် Firebase လိုအပ်သည်။ တစ်ဦးတည်းကစားရန် မလိုပါ။',
      errFull:'လော်ဘီပြည့်နေပါပြီ။', errNotFound:'လော်ဘီ မတွေ့ပါ။',
      errGeneric:'ချိတ်ဆက်မှု မအောင်မြင်ပါ။', connecting:'ချိတ်ဆက်နေသည်…', waitOpp:'ပြိုင်ဘက်ပြီးဆုံးရန် စောင့်နေသည်…',
      win:'🏆 အနိုင်ရ!', lose:'😢 ရှုံးသွားသည်…', draw:'🤝 သရေ' },
    vi: { title:'🆚 Đối kháng', codeLabel:'Mã', start:'Bắt đầu',
      waitHost:'Đang chờ chủ phòng bắt đầu…', back:'← Quay lại', host:'Chủ phòng', guest:'Khách', empty:'(trống)',
      you:'Bạn', opp:'Đối thủ', unavailable:'※ Đối kháng cần cấu hình Firebase. Chơi một mình không cần cấu hình.',
      errFull:'Phòng đã đầy.', errNotFound:'Không tìm thấy phòng.',
      errGeneric:'Kết nối thất bại.', connecting:'Đang kết nối…', waitOpp:'Đang chờ đối thủ kết thúc…',
      win:'🏆 Bạn thắng!', lose:'😢 Bạn thua…', draw:'🤝 Hòa' },
  };
  function L() { return VS[(window.getLang && getLang()) || 'ja'] || VS.ja; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function boot(config) {
    const cfg = window.OSAKA_FIREBASE_CONFIG || {};
    const CONFIGURED = isReal(cfg.apiKey) && isReal(cfg.projectId) && isReal(cfg.authDomain);

    // ---- Firebase (loaded lazily so the lobby UI works even if the
    // CDN import fails — versus then just reports a connection error) ----
    let auth = null, db = null, uid = null;
    let doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, signInAnonymously;
    let fbReady = null;
    function initFirebase() {
      if (!CONFIGURED) return Promise.resolve(false);
      if (!fbReady) {
        fbReady = (async () => {
          try {
            const [appM, authM, fsM] = await Promise.all([
              import("https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js"),
              import("https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js"),
              import("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"),
            ]);
            ({ doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } = fsM);
            signInAnonymously = authM.signInAnonymously;
            const app = appM.initializeApp(cfg);
            auth = authM.getAuth(app);
            db = fsM.getFirestore(app);
            authM.onAuthStateChanged(auth, (u) => { if (u) uid = u.uid; });
            return true;
          } catch (e) { console.warn('firebase init', e); return false; }
        })();
      }
      return fbReady;
    }

    // ---- Lobby state ----
    let lobbyCode = null, mySlot = null, oppSlot = null, unsub = null;
    let started = false, myEnded = false, lastSnap = null;

    function setStatus(msg, warn) {
      const el = $('vsStatus');
      el.textContent = msg || '';
      el.classList.toggle('warn', !!warn);
    }

    function applyVsLang() {
      const t = L();
      $('vsTitle').textContent = t.title;
      $('vsCodeLabel').textContent = t.codeLabel;
      $('vsStartBtn').textContent = t.start;
      $('vsBackBtn').textContent = t.back;
      $('vsUnavailable').textContent = t.unavailable;
    }

    function openLobbyOverlay() {
      applyVsLang();
      $('lobbyOverlay').classList.remove('hidden');
      setStatus('');
      $('vsLobby').classList.toggle('hidden', !CONFIGURED);
      $('vsUnavailable').classList.toggle('hidden', CONFIGURED);
    }

    // Leave the lobby, then return to the setup panel on the games page.
    // Waits briefly so the Firestore delete/update can flush first.
    function backToGamesPage() {
      const go = () => location.replace(config.returnUrl);
      Promise.race([
        leaveLobby(),
        new Promise((r) => setTimeout(r, 800)),
      ]).then(go, go);
    }

    async function ensureAuth() {
      if (!(await initFirebase()) || !auth) { setStatus(L().errGeneric, true); return null; }
      if (uid) return uid;
      try { const cr = await signInAnonymously(auth); uid = cr.user.uid; return uid; }
      catch (e) { console.warn(e); setStatus(L().errGeneric, true); return null; }
    }

    function genCode() {
      let s = '';
      for (let i = 0; i < VS_CODE_LEN; i++) s += VS_SYMBOLS[Math.floor(Math.random() * VS_SYMBOLS.length)].key;
      return s;
    }

    const hooks = {
      onStats(patch) {
        if (!lobbyCode || !mySlot) return;
        const upd = {};
        for (const k in patch) upd[mySlot + '.' + k] = patch[k];
        updateDoc(doc(db, 'lobbies', lobbyCode), upd).catch(() => {});
      },
      onEnd(patch) {
        myEnded = true;
        if (lobbyCode && mySlot) {
          const upd = {};
          for (const k in patch) upd[mySlot + '.' + k] = patch[k];
          updateDoc(doc(db, 'lobbies', lobbyCode), upd).catch(() => {});
        }
        evaluate(lastSnap);
      },
      onRestart() { backToGamesPage(); },
    };

    function subscribe() {
      if (unsub) unsub();
      unsub = onSnapshot(doc(db, 'lobbies', lobbyCode), (snap) => {
        if (!snap.exists()) { setStatus(L().errNotFound, true); return; }
        const d = snap.data();
        lastSnap = d;
        renderLobby(d);
        const opp = d[oppSlot];
        if (started) window.GAME.reportOpponent(opp || null);
        if (d.status === 'playing' && !started) beginMatch();
        if (myEnded) evaluate(d);
      }, (e) => { console.warn(e); setStatus(L().errGeneric, true); });
    }

    function renderLobby(d) {
      $('vsCodeShow').innerHTML = vsCodeImgsHtml(d.code);
      const t = L();
      const row = (slot, roleLabel) => {
        const p = d[slot];
        if (!p) return `<div class="vs-player empty"><span>${roleLabel}</span><span class="tag">${t.empty}</span></div>`;
        const meTag = (slot === mySlot) ? ` (${t.you})` : '';
        return `<div class="vs-player ready"><span>${escapeHtml(p.name || '?')}${meTag}</span><span class="tag">${roleLabel}</span></div>`;
      };
      $('vsPlayers').innerHTML = row('p1', t.host) + row('p2', t.guest);

      const amHost = mySlot === 'p1';
      const bothHere = d.p1 && d.p2;
      $('vsStartBtn').classList.toggle('hidden', !(amHost && bothHere && d.status === 'waiting'));
      $('vsWaiting').textContent = (!amHost && d.status === 'waiting') ? t.waitHost : '';
    }

    function beginMatch() {
      started = true; myEnded = false;
      // clear my slot for a fresh run
      hooks.onStats(Object.assign({ finished: false }, config.initialStats()));
      window.GAME.setVersusResult('', '');
      $('lobbyOverlay').classList.add('hidden');
      window.GAME.startVersus(hooks, lastSnap);
    }

    function evaluate(d) {
      if (!myEnded || !d) return;
      const me = d[mySlot], opp = d[oppSlot];
      const t = L();
      if (!opp || !opp.finished) {
        window.GAME.setVersusResult('draw', t.waitOpp);
        return;
      }
      const outcome = config.compare(me, opp);
      window.GAME.setVersusResult(outcome, t[outcome], config.resultSub(me, opp, t));
    }

    async function createLobby(name, extraDoc) {
      if (!(await ensureAuth())) return;
      setStatus(L().connecting);
      let code = genCode();
      try {
        // avoid an existing code
        for (let i = 0; i < 3; i++) {
          const ex = await getDoc(doc(db, 'lobbies', code));
          if (!ex.exists()) break;
          code = genCode();
        }
        await setDoc(doc(db, 'lobbies', code), Object.assign({
          code, game: config.game, status: 'waiting', host: uid, createdAt: serverTimestamp(),
          p1: Object.assign({ uid, name, finished: false }, config.initialStats()),
          p2: null,
        }, extraDoc || {}));
        lobbyCode = code; mySlot = 'p1'; oppSlot = 'p2'; started = false; myEnded = false;
        setStatus('');
        subscribe();
      } catch (e) { console.warn(e); setStatus(L().errGeneric, true); }
    }

    async function joinLobby(name, code) {
      if (code.length !== VS_CODE_LEN || code.split('').some(ch => !VS_SYMBOLS.some(sy => sy.key === ch))) {
        setStatus(L().errNotFound, true); return;
      }
      if (!(await ensureAuth())) return;
      setStatus(L().connecting);
      try {
        const ref = doc(db, 'lobbies', code);
        const snap = await getDoc(ref);
        if (!snap.exists()) { setStatus(L().errNotFound, true); return; }
        const d = snap.data();
        // pre-tag docs belong to the trash game
        if ((d.game || 'gomi') !== config.game) { setStatus(L().errNotFound, true); return; }
        if (d.p2 && d.p2.uid && d.p2.uid !== uid) { setStatus(L().errFull, true); return; }
        await updateDoc(ref, { p2: Object.assign({ uid, name, finished: false }, config.initialStats()) });
        lobbyCode = code; mySlot = 'p2'; oppSlot = 'p1'; started = false; myEnded = false;
        setStatus('');
        subscribe();
      } catch (e) { console.warn(e); setStatus(L().errGeneric, true); }
    }

    async function startMatch() {
      if (!lobbyCode || mySlot !== 'p1') return;
      try { await updateDoc(doc(db, 'lobbies', lobbyCode), { status: 'playing' }); }
      catch (e) { console.warn(e); setStatus(L().errGeneric, true); }
    }

    async function leaveLobby() {
      if (unsub) { unsub(); unsub = null; }
      const code = lobbyCode, slot = mySlot;
      lobbyCode = null; mySlot = null; oppSlot = null; started = false; myEnded = false; lastSnap = null;
      if (!code || !db) return;
      try {
        if (slot === 'p1') await deleteDoc(doc(db, 'lobbies', code));
        else await updateDoc(doc(db, 'lobbies', code), { p2: null });
      } catch (_) {}
    }

    // ---- Wire UI ----
    $('vsStartBtn').addEventListener('click', startMatch);
    $('vsBackBtn').addEventListener('click', backToGamesPage);
    window.addEventListener('beforeunload', () => { leaveLobby(); });

    // keep lobby labels in sync with the site language toggle
    const _origSync = window.__gameSyncLang;
    window.__gameSyncLang = () => { if (_origSync) _origSync(); applyVsLang(); };

    // ---- Boot: versus intent arrives via URL from the games page ----
    const api = {
      // With deferCreate the page calls this once its setup is done;
      // extraDoc (e.g. { settings: ... }) is merged into the lobby doc.
      createNow(extraDoc) {
        if (!pendingCreateName) return;
        openLobbyOverlay();
        if (CONFIGURED) {
          setStatus(L().connecting);
          createLobby(pendingCreateName, extraDoc);
        }
      },
    };
    let pendingCreateName = null;

    const qp = new URLSearchParams(location.search);
    const vs = qp.get('vs');
    if (vs === 'create' || vs === 'join') {
      const name = (qp.get('name') || '').trim().slice(0, 16);
      const code = (qp.get('code') || '').toUpperCase().slice(0, VS_CODE_LEN);
      if (!name) {
        location.replace(config.returnUrl);
      } else if (vs === 'create' && config.deferCreate) {
        pendingCreateName = name;   // page shows its setup, then createNow()
      } else {
        openLobbyOverlay();
        if (CONFIGURED) {
          setStatus(L().connecting);
          if (vs === 'create') createLobby(name);
          else joinLobby(name, code);
        }
      }
    }
    return api;
  }

  window.VsLobby = { boot };
})();
