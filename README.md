# 🏯 Osaka Support

A small support site for foreigners living in Osaka. Four tools in one
static site:

- **🗑 Trash Sorting Game** — drag-and-drop game teaching Osaka City's
  household-waste rules. 100 items, 3 bins, 6 languages.
- **📝 Kana Quiz** — hiragana/katakana drill with per-row and per-kana
  selection, two finishing modes, and optional Google TTS audio.
- **🎬 Animation Videos** — per-language video library; uploads stored
  locally in the browser (IndexedDB).
- **💬 Anonymous Chat** — visitors message the site creator privately
  with photos. Backed by Firebase Auth + Firestore; translation via
  Google Cloud Translation.

Site UI is available in **Japanese / English / 中文 / 한국어 / မြန်မာ /
Tiếng Việt**. The language picker lives in the header and the choice
persists across pages.

---

## Table of contents

1. [Project structure](#project-structure)
2. [Run locally](#run-locally)
3. [The Trash Sorting Game](#the-trash-sorting-game)
4. [The Kana Quiz](#the-kana-quiz)
5. [The Videos tab](#the-videos-tab)
6. [The Contact / chat tab](#the-contact--chat-tab)
7. [Firebase setup](#firebase-setup)
8. [Deploy to Render](#deploy-to-render)
9. [Privacy notes](#privacy-notes)
10. [Browser compatibility](#browser-compatibility)

---

## Project structure

```
.
├── index.html        home — 3 category cards (Daily Life / Games / EJU)
├── daily.html        Daily Life hub → Videos + Contact, emergency info, tips
├── games.html        Games hub → Trash game + Kana quiz
├── eju.html          EJU placeholder ("coming soon")
├── game.html         trash-sorting game
├── kana.html         hiragana/katakana quiz (optional Google TTS audio)
├── videos.html       per-language video library
├── contact.html      anonymous chat (Firebase)
├── images/
│   └── logo.svg      site logo (editable SVG — see "Branding" below)
├── styles.css        shared site styles + theme colors (the :root block)
├── common.js         LANGS, header/nav rendering, VideoDB, reaction popups
├── render.yaml       Render Blueprint — declares env vars, build command, headers
└── README.md         this file
```

No build system. The whole site is plain HTML / CSS / vanilla JS. Firebase
is loaded as ES modules from the Google CDN at runtime.

### Navigation

The header is the same on every page: a logo + four top-level tabs —
**Home**, **Daily Life**, **Games**, **EJU**. Daily Life and Games are hub
pages that link to the actual tools; the individual tool pages (videos,
contact, game, kana) highlight their parent tab.

### Branding (logo & colors)

- **Logo:** `images/logo.svg` is plain SVG text, so you can edit it
  directly on GitHub (change shapes/colors) or replace the file with your
  own logo — keep the path `images/logo.svg` (every page's header points at
  it) or update the `<img src="images/logo.svg">` in each header.
- **Colors:** the whole site is themed from the `:root` block at the top of
  `styles.css` — green (`--c-accent`), white (`--c-bg` / `--c-panel`), and a
  little red (`--c-red`). Change those variables to re-theme everything,
  games included. The trash-game bin categories use `--c-burnable` (red),
  `--c-recycle` (green), and `--c-plastic` (blue) so the three bins stay
  distinguishable.

---

## Run locally

You just need any static file server. From the repo root, pick one:

```bash
# Python (any modern version)
python3 -m http.server 8000

# or Node
npx serve .

# or VS Code "Live Server" extension
```

Then open <http://localhost:8000>.

The Game and Videos tabs work fully offline. The Contact tab shows a
"setup required" screen until you fill in Firebase credentials (see
[Firebase setup](#firebase-setup)).

---

## The Trash Sorting Game

`game.html`. An endless arcade round: trash items keep appearing and
**grow over time**. Drag each one to the correct bin before it gets too
big — three bins:

| Bin                   | What goes in it                                    |
| --------------------- | -------------------------------------------------- |
| **普通ごみ**          | Burnable / general: kitchen waste, soiled paper, leather, rubber, small wood, diapers, CDs, ceramics. |
| **資源ごみ**          | Cans, glass bottles, PET bottles. Rinsed.          |
| **容器包装プラスチック** | Plastic packaging with the プラ ♻️ mark.           |

Mechanic:
- Several items are on screen at once; new ones fade in slowly at
  random spots and grow from small to large.
- An item turns red as it nears full size, then **shakes and explodes**,
  costing a life. Sorting it correctly scores points (streak bonus);
  sorting it wrong also costs a life.
- A correct or wrong drop briefly **pauses** the game to show a popup
  explaining the right category, then play resumes.
- 3 lives; the run ends when they're gone. Difficulty ramps up (faster
  spawns and growth) the longer you survive. Rank by final score.
- The left/right edges of the play area are kept clear so the
  maru/batsu reaction popups have room.

### Single-player vs Versus

The start screen offers **Single** and **Versus (2P)**. Single-player
works with no setup. Versus is a quick 1-v-1 score race backed by
Firebase (the same project the chat uses):

- One player taps **Versus**, enters a username, and **creates a
  lobby** — they get a 4-character code. The other player enters their
  name and **joins** with that code.
- The host taps **Start**; both play their own board at the same time.
  A small HUD shows the opponent's live **score** and **lives**.
- When a player's lives run out their run ends; once both are done the
  result screen shows **Win / Lose / Draw** with both scores. (Each
  board has its own random trash, so it's a fair score race rather than
  an identical board.)
- Versus needs Firebase configured (`FIREBASE_*` env vars) **and** the
  `lobbies` Firestore rule above. Without it, the Versus screen shows a
  "setup needed" notice and single-player still works. The Firebase
  config is injected into `game.html` at build time, exactly like
  `contact.html`.

All 100 items are based on the 大阪市環境局 (Osaka City Environmental
Bureau) household sorting guide. Tips share 17 reason keys
(`kitchen`, `leather`, `glass_bottle`, `plastic_tray`, etc.) translated
once per language instead of per item.

### Reaction popups (shared with the Kana Quiz)

On every answer, both games pop a small **maru (○) / batsu (✗)** image
in an empty corner of the screen (avoiding the header, bins, and the
centered card/feedback) and play a sound — a bright ping for correct,
a descending "du-dunn" buzzer for wrong. The image fades out after ~1s
and never blocks input (`pointer-events: none`).

- Sounds are synthesized with the Web Audio API — no audio files.
- Images live under `images/reactions/correct/` and
  `images/reactions/wrong/`. The manifest is `REACTION_IMAGES` near the
  bottom of `common.js`; one image is chosen at random per outcome, so
  you can add as many as you like. See the `README.md` in each image
  folder. The two starter files are `maru1.png` and `batsu1.png`.
- A missing image file is removed on error (no broken icon); the sound
  still plays.

---

## The Kana Quiz

`kana.html`. A configurable hiragana / katakana drill.

**Selection (setup screen)**

- Two tabs — **Hiragana** and **Katakana** — each with an independent
  selection and a live count. You configure each script separately.
- 104 kana: basic gojūon (46), dakuten / handakuten (25), and yōon
  combos (33).
- Toggle at any level: whole group (the ◧ button), whole row (the
  romaji button), or an individual kana chip.
- Quick category toggles for **Dakuten / Handakuten** (が) and **Yōon**
  (きゃ) sit right above the grid and flip those whole categories on/off
  for the active script; they light up when fully selected.
- Presets: **All / None / Basic only / Copy from the other script.**

**Modes**

- **Master mode** — keep going until every selected kana has been
  answered correctly at least once. A wrong answer keeps it in the
  pool. Progress bar shows mastered / total.
- **Count mode** — finish after a set number of correct answers
  (10 / 20 / 30 / 50). Progress bar shows correct / target.

**Quiz**

- Shows a kana; you type the romaji and press Enter / Check. Correct
  flashes green and auto-advances; wrong pauses on the answer until you
  continue. Standard alternate spellings are accepted (`shi`/`si`,
  `tsu`/`tu`, `fu`/`hu`, `ji`/`zi`, `ja`/`jya`/`zya`, `n`/`nn`/`n'`, …).
- **🔊 Audio toggle** (only shown when `GOOGLE_TTS_API_KEY` is set):
  plays the kana's reading via Google Cloud Text-to-Speech after each
  answer, right or wrong. Synthesized MP3 is cached per kana so a
  repeat doesn't re-call the API. The preference is remembered in
  `localStorage`.
- Results screen: accuracy %, question count, elapsed time, and a
  "kana to review" list of the most-missed characters.

### Google TTS for the kana audio

The 🔊 toggle uses the **Google Cloud Text-to-Speech** REST API
(`ja-JP`, MP3). Enable the **Cloud Text-to-Speech API** in your Google
Cloud project, create an API key, and set it as the `GOOGLE_TTS_API_KEY`
env var (see [Deploy to Render](#deploy-to-render)). It can be the same
key as `GOOGLE_TRANSLATE_API_KEY` as long as that key has the
Text-to-Speech API enabled. Without the key the audio toggle is simply
hidden and the quiz works normally.

---

## The Videos tab

`videos.html`. Pick a language pill at the top — that selects both the
filter (which language's videos you see) and the destination bucket for
new uploads. Then either:

- Click **Upload video** and choose a file, or
- Drag a video file onto the dashed box.

Videos are stored locally in the browser via **IndexedDB** (DB
`osaka_support`, store `videos`, indexed by `lang`). They persist across
page reloads on the same device but are not synced anywhere — this is
deliberately a per-device library.

Each card shows the inline `<video>` player, filename, file size, upload
date, and a **Delete** button.

---

## The Contact / chat tab

`contact.html`. Two roles share the same page:

- **Visitor view** — opening `contact.html` shows a privacy banner, a
  language picker, an optional topic chip, and a **Start chat** button.
  The visitor is signed in anonymously via Firebase Auth (random UID,
  no email/name) and their chat thread is keyed by that UID.
- **Admin view** — opening `contact.html#admin` shows an email/password
  login form. The signed-in admin (you) sees a live-updating list of
  all chats sorted by most-recent activity, and can click any one to
  reply.

Inside an open chat:

- Type a message → **Enter** to send, **Shift+Enter** for newline.
- 📎 icon → upload an image. The image is decoded into a `<canvas>` and
  re-encoded as JPEG (max 1024 px, ~78% quality) before being stored as
  a data URL on the message document. EXIF/GPS metadata is stripped by
  this round-trip.
- 🌐 **Translate** toggle — uses **Google Cloud Translation API v2**
  so it works in every browser. When ON, messages from the other party
  are translated into your language and pre-translated in the
  background so the toggle feels instant. Per-message results are
  cached in memory. Disabled with a notice if
  `GOOGLE_TRANSLATE_API_KEY` is not configured.
- ⛔ **End** — deletes the conversation. Messages + chat doc are
  removed via a batched `writeBatch`, then visitors are signed out so
  a new Start chat creates a fresh thread under a brand-new anonymous
  UID. Admins return to the chat list.
- × — minimizes (closes the view but keeps the thread). Admin returns
  to the chat list; visitor returns to the pre-chat screen and can
  reopen the same thread with **Start chat** again.
- **Ping sound** — a short two-tone "ding" plays via the Web Audio API
  when a new message from the other party arrives, and (for admins)
  when a brand-new chat appears in the list. AudioContext unlocks on
  the first click/keypress so the very first ping may be silent.
- **Send button + Enter** are both reentrancy-guarded with a
  `state.sending` flag; the textarea is cleared *before* the
  `addDoc` await so a rapid second Enter cannot resend the same
  message.

### Admin chat management

In the admin dashboard:

- The chat list updates in real time via `onSnapshot` — new chats
  appear and re-sort as visitors send messages, no refresh needed.
- Each row has a 🗑 button that deletes the chat (messages first,
  then the chat doc) after a confirmation prompt.

### Firestore rules update for delete

The rules below allow both **the owner** (visitor for their own
chat) and **the admin** to delete a chat and its messages. This is
required for the End / 🗑 buttons to work. See
[Firebase setup](#firebase-setup) for the full rules block.

---

## Firebase setup

The Contact tab uses Firebase Authentication + Firestore. ~10 minutes
of one-time setup in the Firebase Console.

1. Go to <https://console.firebase.google.com> → **Create a project**.

2. Enable these services in your project:
   - **Authentication → Sign-in method → Anonymous** → Enable.
   - **Authentication → Sign-in method → Email/Password** → Enable.
   - **Firestore Database → Create database** → Production mode, region
     close to you (e.g. `asia-northeast1` for Osaka).

3. **Authentication → Users → Add user.** Enter the email + password
   you want to use as the admin login. Remember the email — it goes
   into the `OSAKA_ADMIN_EMAIL` env var.

4. **Project Settings (gear icon) → General → Your apps → Add a web
   app (`</>`).** Register it. Firebase will show a `firebaseConfig`
   object with these six values — you'll paste them as env vars in
   Render (or as inline values for local dev):

   - `apiKey` → `FIREBASE_API_KEY`
   - `authDomain` → `FIREBASE_AUTH_DOMAIN`
   - `projectId` → `FIREBASE_PROJECT_ID`
   - `storageBucket` → `FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `FIREBASE_APP_ID`

5. **Firestore Database → Rules.** Paste the block below and replace
   `REPLACE_WITH_ADMIN_EMAIL` with the same email from step 3, then
   **Publish**.

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       function isAdmin() {
         return request.auth != null
             && request.auth.token.email == "REPLACE_WITH_ADMIN_EMAIL";
       }
       function isOwner(chatId) {
         return request.auth != null
             && request.auth.uid == chatId;
       }

       match /chats/{chatId} {
         allow get:    if isOwner(chatId) || isAdmin();
         allow list:   if isAdmin();
         allow create: if isOwner(chatId)
                       && request.resource.data.ownerUid == request.auth.uid;
         allow update: if isOwner(chatId) || isAdmin();
         allow delete: if isOwner(chatId) || isAdmin();

         match /messages/{messageId} {
           allow read:   if isOwner(chatId) || isAdmin();
           allow create: if (isOwner(chatId) || isAdmin())
                         && request.resource.data.senderUid == request.auth.uid
                         && request.resource.data.text is string
                         && request.resource.data.text.size() < 4000;
           allow update: if false;
           allow delete: if isOwner(chatId) || isAdmin();
         }
       }

       // Trash-game Versus lobbies. Any signed-in (anonymous) player
       // may create / join / update a lobby. Casual game data — kept
       // simple on purpose.
       match /lobbies/{code} {
         allow read, create, update, delete: if request.auth != null;
       }
     }
   }
   ```

6. **Translation API key (optional, but recommended)**.
   Go to <https://console.cloud.google.com> → APIs & Services →
   Library → enable **Cloud Translation API**. Then APIs & Services
   → Credentials → **Create credentials → API key**. Restrict it to
   **Cloud Translation API only** and to your `*.onrender.com`
   referrer for safety. This key becomes the
   `GOOGLE_TRANSLATE_API_KEY` env var. Without it, the chat still
   works fully — only the 🌐 Translate button is disabled.

7. After the site is deployed, come back to
   **Authentication → Settings → Authorized domains** and add the
   `*.onrender.com` host Render gave you. Without this step, sign-in
   fails on the deployed URL (but still works on `localhost`).

### Local development with Firebase

`contact.html` embeds the Firebase config inline using `@@…@@`
placeholders that the Render build step substitutes (see
[Deploy to Render](#deploy-to-render)). For local dev:

- Easiest: open `contact.html` in your editor, find the
  `<script>window.OSAKA_FIREBASE_CONFIG = {…</script>` block, and
  temporarily paste your values in place of the placeholders.
- **Don't commit those values.** `git restore contact.html` before
  committing other changes, or work on a private branch.

---

## Deploy to Render

The repo includes a `render.yaml` Blueprint that provisions a free
static site and bakes the Firebase keys in from environment variables —
nothing sensitive lives in git.

1. Push the repo to GitHub.
2. Open <https://dashboard.render.com> → **New +** → **Blueprint**.
3. Connect GitHub if asked, pick this repo, pick the branch.
4. Render reads `render.yaml`. Because every env var below is declared
   `sync: false`, Render will prompt you for each one in the Blueprint
   preview. Paste in:

   ```
   FIREBASE_API_KEY
   FIREBASE_AUTH_DOMAIN
   FIREBASE_PROJECT_ID
   FIREBASE_STORAGE_BUCKET
   FIREBASE_MESSAGING_SENDER_ID
   FIREBASE_APP_ID
   OSAKA_ADMIN_EMAIL
   GOOGLE_TRANSLATE_API_KEY   # optional (chat translation)
   GOOGLE_TTS_API_KEY         # optional (kana quiz audio)
   ```

   Click **Apply**.

5. Render gives you an HTTPS URL like
   `https://osaka-support.onrender.com`.

6. Add that URL to **Firebase → Authentication → Settings →
   Authorized domains**.

### How the build works

The Blueprint's `buildCommand` does two things:

- Logs each of the 7 env vars with a masked preview (first 3 + last 3
  chars + length) or `<empty / unset>`, so the deploy log alone tells
  you whether the values are reaching the build environment.
- Runs `sed -i` over `contact.html`, replacing every `@@FIREBASE_*@@`
  / `@@OSAKA_ADMIN_EMAIL@@` token with the matching env var's value
  (using `${VAR:-}` defaults so a missing var becomes an empty string,
  not a build failure).

The page then treats any value that's empty or that still starts with
`@@` as not-configured, and shows a setup screen with a diagnostic
that distinguishes between **placeholder** (build never substituted)
and **empty** (env var not set on Render).

### Updating Firebase keys later

Render dashboard → your service → **Environment** tab → edit → save.
Render auto-redeploys and the build step rewrites `contact.html` with
the new values. Because `contact.html` is served with
`Cache-Control: no-store`, browsers pick up the new keys immediately.

---

## Privacy notes

- **No visitor PII collected.** Anonymous Firebase Auth gives each
  visitor a random UID — no name, email, phone, or device identifier.
- **Per-chat isolation.** Firestore rules restrict each chat thread
  to its owner (matching UID) and the admin (matching email). No
  other authenticated user can list or read another visitor's chat.
- **Translation via Google Cloud Translation.** When the 🌐 Translate
  toggle is on, message text is sent to
  `translation.googleapis.com` with your API key over HTTPS so it
  can be translated for the viewer. Each translation result is
  cached in the browser tab's memory so the same message isn't
  re-sent twice. If `GOOGLE_TRANSLATE_API_KEY` is not configured,
  no translation calls are made and message text stays in its
  original language — nothing is sent anywhere.
- **Image metadata stripped.** Uploaded images go through a canvas
  decode + JPEG re-encode, which removes EXIF / GPS metadata before
  the file is written to Firestore.
- **Not end-to-end encrypted.** Message bodies, timestamps, IPs, and
  anonymous UIDs are visible to Google as the Firebase infrastructure
  provider. If you need true E2E, you'd add a client-side encryption
  layer before writing to Firestore — that's a bigger change not in
  this build.
- **Videos stay local.** The Videos tab stores files only in the
  uploader's own browser via IndexedDB. They're never uploaded
  anywhere.

---

## Browser compatibility

- **Game**, **Videos**, and the Contact UI: any modern browser
  (Chrome, Firefox, Safari, Edge). Drag-and-drop in the game and the
  chat input use Pointer Events, which work on mouse and touch.
- **Chat translation toggle**: uses Google Cloud Translation API v2
  over HTTPS, so it works in every modern browser. If
  `GOOGLE_TRANSLATE_API_KEY` is not configured, the toggle is shown
  with a "not configured" notice and messages stay in their original
  language.
- **Ping sound**: uses the Web Audio API, which needs a user gesture
  to unlock — the first click or keypress on the page unlocks it.
  The very first incoming ping may therefore be silent if no user
  interaction has happened yet.
- **Kana quiz audio**: uses Google Cloud Text-to-Speech over HTTPS and
  plays the result with an `<Audio>` element, so it works in every
  modern browser. The toggle only appears when `GOOGLE_TTS_API_KEY`
  is configured. Playback is triggered by your answer (a user
  gesture), so autoplay restrictions don't block it.
- **Burmese rendering**: shared styles include `Noto Sans Myanmar`,
  `Pyidaungsu`, and `Padauk` as font fallbacks. Most platforms ship
  one of these.

---

## Credits

- Trash categories and items: based on the Osaka City Environmental
  Bureau (大阪市環境局) household-waste sorting guide.
- Built as an iterative side project; not affiliated with the City
  of Osaka.
