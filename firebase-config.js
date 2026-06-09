/* ============================================================
   firebase-config.js — Firebase credentials for the Contact chat
   ============================================================

   ⚠️ When deployed via Render, this file is REGENERATED at build
   time from environment variables. The empty placeholder values
   below are intentional — Render's build step overwrites them
   with the values you set in the Render dashboard before serving
   the site. See render.yaml > buildCommand.

   → To change keys in production, edit the env vars in:
       Render dashboard > your service > Environment tab.
     Render redeploys automatically and rewrites this file. Do
     NOT commit real keys to git.

   → For local development, fill the values in below by hand and
     just don't commit those changes
     (`git restore firebase-config.js` before committing).

   ----------------------------------------------------------------
   ONE-TIME SETUP (in Firebase Console, ~10 minutes)
   ----------------------------------------------------------------
   1. https://console.firebase.google.com → Create a project.

   2. In your project, enable:
        Authentication > Sign-in method > Anonymous       → Enable
        Authentication > Sign-in method > Email/Password  → Enable
        Firestore Database > Create database              → Production mode
        (pick a region close to you, e.g. asia-northeast1 for Osaka)

   3. Authentication > Users > Add user.
        Enter the email + password to use as the admin (site
        creator) login. Remember the email — it goes into the
        OSAKA_ADMIN_EMAIL env var.

   4. Project Settings (gear icon) > General > "Your apps" >
      Add a web app (</>). Register it. Firebase shows a config
      object with the six values listed below — paste them into
      the matching env vars on Render (or into the placeholders
      here for local dev only).

   5. Firestore Database > Rules tab — paste the rules block at
      the bottom of this file. Replace REPLACE_WITH_ADMIN_EMAIL
      with the same email you used in step 3. Publish.

   6. After Render gives you a *.onrender.com URL, add it under
        Authentication > Settings > Authorized domains
      so the deployed site can sign visitors in.

   ----------------------------------------------------------------
   PRIVACY NOTES
   ----------------------------------------------------------------
   - Visitors sign in via Firebase Anonymous Auth. They get a
     random UID; no email or PII is collected by this site.
   - Each visitor can only read/write their own chat thread,
     enforced by the Firestore rules below.
   - Only the admin (OSAKA_ADMIN_EMAIL) can list and read all
     chats.
   - Translation runs ON-DEVICE via the Chrome 138+ Translator
     API; messages are not sent to translation servers.
   - However, Firebase is operated by Google. Message bodies,
     timestamps, IPs, and anonymous UIDs are visible to Google
     as the infra provider. This is NOT end-to-end encrypted.
   - Image uploads are decoded into a canvas and re-encoded as
     JPEG client-side, which strips EXIF / GPS metadata before
     storage.
   ============================================================ */

window.OSAKA_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

window.OSAKA_ADMIN_EMAIL = "";

/* ============================================================
   FIRESTORE SECURITY RULES — paste into Firestore > Rules tab.
   Replace REPLACE_WITH_ADMIN_EMAIL with your actual admin email,
   then click Publish.
   ============================================================

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
   ============================================================ */
