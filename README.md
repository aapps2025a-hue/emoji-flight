# Emoji Flight with accounts

Run `START.cmd` on Windows with Python installed, then open http://127.0.0.1:18943 in Chrome. Keep the server window running. Alternatively run `python server.py`.

Create an account on the login screen. The app saves coins, owned aircraft, inventory, unlocked airports, catering stock and custom airlines/logos. Active flights restart at the terminal. Each account starts fresh; old browser-only saves are left untouched. Saves are loaded before the game starts, and save failures are shown above the game. A newer save from another tab causes a conflict instead of being overwritten.

## Database and GitHub

`schema.sql` creates the SQLite database automatically in `data/players.sqlite3`. Passwords are salted and hashed with scrypt. Sessions use HttpOnly cookies and hashed random tokens. Keep a private backup of the data directory with the server stopped.

Commit the source and schema to GitHub. Do not upload the data directory: `.gitignore` excludes player accounts and saves. GitHub stores the source; GitHub Pages cannot run this Python server or a writable SQLite database. Source repository: https://github.com/aapps2025a-hue/emoji-flight. GitHub Pages deployment is not enabled: the login and save API requires a running backend.

This runnable edition is restricted to this computer (localhost). For online play across devices it needs a server with persistent storage, HTTPS, secure cookies, production HTTP hosting and deployment configuration. Do not expose the development server directly to the internet. There is no password recovery in this edition. The game remains client-authoritative and is not intended for competitive or real-money balances.
