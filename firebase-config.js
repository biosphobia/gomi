/* ============================================================
   firebase-config.js — fill this in to enable the Contact chat.
   ============================================================

   The Contact tab in this site uses Firebase for real-time chat
   between you (the admin) and visitors who message you anonymously.
   This file is a placeholder. Until you fill it in and apply the
   Firestore rules below, the Contact page will show a setup notice
   instead of the chat UI.

   ----------------------------------------------------------------
   SETUP (one time, ~10 minutes)
   ----------------------------------------------------------------
   1. Go to https://console.firebase.google.com and create a project.

   2. In your new project, enable:
        Authentication > Sign-in method > Anonymous       → Enable
        Authentication > Sign-in method > Email/Password  → Enable
        Firestore Database > Create database              → Production mode
        (pick a region close to you, e.g. asia-northeast1 for Osaka)

   3. Authentication > Users > Add user.
        Enter the email + password you want to use as the admin
        (this site's creator) login. Remember the email — you'll
        paste it into OSAKA_ADMIN_EMAIL below.

   4. Project Settings (the gear icon, top left) > General >
      "Your apps" > Add a web app (</> icon).
        Give it a nickname (e.g. "osaka-support") and register it.
        Copy the firebaseConfig object that Firebase shows you and
        paste it into OSAKA_FIREBASE_CONFIG below.

   5. Set OSAKA_ADMIN_EMAIL below to the email from step 3.

   6. Go to Firestore Database > Rules tab and replace whatever's
      there with the rules block at the bottom of this file.
        ⚠ IMPORTANT: change "REPLACE_WITH_ADMIN_EMAIL" inside the
        rules to your actual admin email (the same one from step 3).
        Then click Publish.

   7. Save this file. Reload contact.html in your browser. Visit
        contact.html             — the visitor view.
        contact.html#admin       — the admin login + chat list.

   ----------------------------------------------------------------
   PRIVACY NOTES (read me before deploying)
   ----------------------------------------------------------------
   - Visitors sign in via Firebase Anonymous Auth. They get a random
     UID; no email, name, or identifier is collected by this site.
   - Each visitor can only read/write their own chat thread, scoped
     by their UID. The Firestore rules below enforce this.
   - Only the admin (you, signed in with OSAKA_ADMIN_EMAIL) can list
     and read all chat threads.
   - Translation runs ON DEVICE via the Chrome 138+ Translator API.
     Messages are not sent to Google Translate or any other server
     for translation.
   - HOWEVER: Firebase is operated by Google. Message contents,
     timestamps, IP addresses, and the anonymous UIDs are visible
     to Google as the infrastructure provider. The site is NOT
     end-to-end encrypted. For stronger privacy you would need to
     add client-side encryption before writing to Firestore — out
     of scope for this basic build.
   - Image uploads are resized and re-encoded as JPEG client-side,
     which strips EXIF / location metadata before storage.
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
