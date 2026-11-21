# Emoji Flight — Firebase edition

Static browser game for GitHub Pages with Firebase email/password Authentication and Firestore saves. The frontend no longer calls a Python /api server.

## Live setup status

Firebase project: `emoji-flight-aapps2025`. Firestore `(default)` is created in `eur3` on the free tier. The rules in `firestore.rules` are deployed. Firebase Authentication is active with Email/Password enabled. The GitHub Pages domain is authorized. No billing was enabled. Play at https://aapps2025a-hue.github.io/emoji-flight/.

## Saved data

Accounts use email/password. Each user owns `players/{uid}` and its `chunks` subcollection. Atomic Firestore transactions save coins, purchases, airports, catering and custom airline logos. Revision checks reject stale tabs. Active flights restart at the terminal. Passwords are handled by Firebase Authentication, never stored in Firestore. Existing local SQLite accounts and saves are preserved locally but not migrated; create a new Firebase account.

## Hosting

GitHub Pages serves `/docs` on `main`. `docs` is a copy of `public`; copy public files again when updating the site. All browser paths are relative so project Pages URLs work.

For local preview run `START.cmd` and open http://127.0.0.1:18944/. Firebase requires internet access. The old Python server and schema remain for reference but are not used by this frontend.

Deploy rules: `firebase deploy --only firestore:rules --project emoji-flight-aapps2025`.
The Firebase web configuration is public app identification, not an admin credential; access control is enforced by Firestore rules. Do not commit data/, service-account keys or private tokens. This game is client-authoritative and not for competitive or real-money balances.

## Validation

JavaScript syntax and mocked Firebase adapter tests passed (save/load, account separation, stale revision rejection, Unicode chunking and sign-out). Firestore rules compiled and deployed. Live Firebase registration, sign-in, save restoration, cross-account read/write denial and anonymous read denial passed. Temporary test accounts and saves were removed.
