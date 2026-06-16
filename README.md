# 🏯 Osaka Support

A small support site for foreigners living in Osaka. Three tools in one
static site:

- **🗑 Trash Sorting Game** — drag-and-drop game teaching Osaka City's
  household-waste rules. 100 items, 3 bins, 6 languages.
- **🎬 Animation Videos** — per-language video library; uploads stored
  locally in the browser (IndexedDB).
- **💬 Anonymous Chat** — visitors message the site creator privately
  with photos, with on-device translation. Backed by Firebase.

Site UI is available in **Japanese / English / 中文 / 한국어 / မြန်မာ /
Tiếng Việt**. The language picker lives in the header and the choice
persists across pages.

---

## Table of contents

1. [Project structure](#project-structure)
2. [Run locally](#run-locally)
3. [The Trash Sorting Game](#the-trash-sorting-game)
4. [The Videos tab](#the-videos-tab)
5. [The Contact / chat tab](#the-contact--chat-tab)
6. [Firebase setup](#firebase-setup)
7. [Deploy to Render](#deploy-to-render)
8. [Privacy notes](#privacy-notes)
9. [Browser compatibility](#browser-compatibility)

---

## Project structure

```
.
├── index.html        landing page (hero, feature cards, emergency contacts, tips)
├── game.html         trash-sorting game
├── videos.html       per-language video library
├── contact.html      anonymous chat (Firebase)
├── styles.css        shared site styles (header, nav, cards, language picker)
├── common.js         LANGS, getLang/setLang, site-header rendering, VideoDB
├── render.yaml       Render Blueprint — declares env vars, build command, headers
└── README.md         this file
```

No build system. The whole site is plain HTML / CSS / vanilla JS. Firebase
is loaded as ES modules from the Google CDN at runtime.

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

`game.html`. Drag the item that appears in the center to one of three bins:

| Bin                   | What goes in it                                    |
| --------------------- | -------------------------------------------------- |
| **普通ごみ**          | Burnable / general: kitchen waste, soiled paper, leather, rubber, small wood, diapers, CDs, ceramics. |
| **資源ごみ**          | Cans, glass bottles, PET bottles. Rinsed.          |
| **容器包装プラスチック** | Plastic packaging with the プラ ♻️ mark.           |

20 rounds per game, 3 lives, score grows with streak. Correct answers
auto-advance; wrong answers pause on a popup explaining the correct
category until you click **Continue**.

All 100 items are based on the 大阪市環境局 (Osaka City Environmental
Bureau) household sorting guide. Tips share 17 reason keys
(`kitchen`, `leather`, `glass_bottle`, `plastic_tray`, etc.) translated
once per language instead of per item.

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
- 🌐 **Translate** toggle — runs on-device through the Chrome 138+
  Translator API. When ON, messages from the other party are
  translated into your language and pre-translated in the background
  so the toggle feels instant. Falls back to a "not supported" notice
  if the browser doesn't expose `Translator`.
- × — closes the chat and (for admins) goes back to the chat list.

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
         allow delete: if false;

         match /messages/{messageId} {
           allow read:   if isOwner(chatId) || isAdmin();
           allow create: if (isOwner(chatId) || isAdmin())
                         && request.resource.data.senderUid == request.auth.uid
                         && request.resource.data.text is string
                         && request.resource.data.text.size() < 4000;
           allow update, delete: if false;
         }
       }
     }
   }
   ```

6. After the site is deployed, come back to
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
- **On-device translation.** Translation runs entirely in the
  browser via Chrome's `Translator` API. Message contents are never
  sent to Google Translate or any other translation service.
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
- **Chat translation toggle**: requires Chrome 138+ on desktop or
  Android with the `Translator` API enabled. On other browsers the
  toggle shows a "not supported" notice and falls back to showing
  messages in their original language.
- **Burmese rendering**: shared styles include `Noto Sans Myanmar`,
  `Pyidaungsu`, and `Padauk` as font fallbacks. Most platforms ship
  one of these.

---

## Credits

- Trash categories and items: based on the Osaka City Environmental
  Bureau (大阪市環境局) household-waste sorting guide.
- Built as an iterative side project; not affiliated with the City
  of Osaka.
