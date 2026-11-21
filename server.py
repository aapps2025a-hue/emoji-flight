"""Emoji Flight local account server. Python 3.10+, no dependencies."""
import hashlib, hmac, json, re, secrets, sqlite3, time
from pathlib import Path
from contextlib import contextmanager

@contextmanager
def connect(*args, **kwargs):
    connection = sqlite3.connect(*args, **kwargs)
    try:
        with connection:
            yield connection
    finally:
        connection.close()

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
DB = DATA / 'players.sqlite3'
with connect(DB) as db:
    db.executescript((ROOT / 'schema.sql').read_text())

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def reply(self, status, value, cookie=None):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie: self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def user(self, db):
        cookie = SimpleCookie()
        try: cookie.load(self.headers.get('Cookie', ''))
        except Exception: return None
        token = cookie.get('session')
        if not token: return None
        return db.execute('SELECT users.id, username, save, revision FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?', (hashlib.sha256(token.value.encode()).hexdigest(), time.time())).fetchone()
    def do_GET(self):
        if self.path == '/api/me':
            with connect(DB) as db: row = self.user(db)
            return self.reply(200, {'username':row[1], 'save':json.loads(row[2]), 'revision':row[3]} if row else {'username':None})
        files = {'/':'index.html', '/game':'game.html', '/account.js':'account.js'}
        if self.path not in files: return self.reply(404, {'error':'Not found'})
        if self.path == '/game':
            with connect(DB) as db: row = self.user(db)
            if not row:
                self.send_response(303); self.send_header('Location','/'); self.end_headers(); return
        path = ROOT / 'public' / files[self.path]
        body = path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript; charset=utf-8' if path.suffix=='.js' else 'text/html; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        # Custom header and same-origin checks prevent cross-site form/API writes.
        if self.headers.get('Host') not in ('127.0.0.1:18943','localhost:18943') or self.headers.get('X-Flight-App') != '1':
            return self.reply(403, {'error':'Request blocked'})
        origin = self.headers.get('Origin')
        if origin and origin not in ('http://127.0.0.1:18943','http://localhost:18943'):
            return self.reply(403, {'error':'Request blocked'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8_000_000: raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data,dict): raise ValueError()
        except (ValueError, UnicodeError): return self.reply(400, {'error':'Invalid request'})
        with connect(DB, timeout=15) as db:
            if self.path in ('/api/login','/api/register'):
                username, password = data.get('username',''), data.get('password','')
                if not isinstance(username,str) or not isinstance(password,str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,24}',username) or not 10 <= len(password) <= 128:
                    return self.reply(400, {'error':'Use a 3–24 character username (letters, numbers, _ or -) and a 10–128 character password.'})
                now=time.time()
                db.execute('DELETE FROM attempts WHERE created<?',(now-600,))
                if db.execute('SELECT count(*) FROM attempts WHERE name=?',(username.lower(),)).fetchone()[0]>=10:
                    return self.reply(429, {'error':'Too many attempts. Try again in 10 minutes.'})
                db.execute('INSERT INTO attempts VALUES (?,?)',(username.lower(),now)); db.commit()
                row=db.execute('SELECT id,salt,password FROM users WHERE username=? COLLATE NOCASE',(username,)).fetchone()
                if self.path == '/api/register':
                    if row: return self.reply(409, {'error':'Choose another username.'})
                    salt=secrets.token_hex(16)
                    digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
                    uid=db.execute('INSERT INTO users(username,salt,password) VALUES (?,?,?)',(username,salt,digest)).lastrowid
                else:
                    salt=row[1] if row else 'invalid-account-salt'
                    digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
                    if not row or not hmac.compare_digest(row[2],digest): return self.reply(401, {'error':'Username or password is incorrect.'})
                    uid=row[0]
                token=secrets.token_urlsafe(32)
                db.execute('DELETE FROM sessions WHERE expires<?',(now,))
                db.execute('INSERT INTO sessions VALUES (?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),uid,now+604800))
                return self.reply(200, {'ok':True}, f'session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800')
            row=self.user(db)
            if not row: return self.reply(401, {'error':'Please sign in again.'})
            if self.path == '/api/logout':
                cookie=SimpleCookie(self.headers.get('Cookie',''))
                db.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(cookie['session'].value.encode()).hexdigest(),))
                return self.reply(200, {'ok':True}, 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if self.path == '/api/save':
                save=data.get('save')
                if not isinstance(save,dict) or set(save)-{'progress','airlines'} or not all(isinstance(v,str) for v in save.values()):
                    return self.reply(400, {'error':'Invalid save'})
                try:
                    progress=json.loads(save.get('progress','{}')); airlines=json.loads(save.get('airlines','[]'))
                    if not isinstance(progress,dict) or not isinstance(airlines,list) or len(airlines)>20: raise ValueError()
                except ValueError: return self.reply(400, {'error':'Invalid save'})
                changed=db.execute('UPDATE users SET save=?,revision=revision+1 WHERE id=? AND revision=?',(json.dumps(save),row[0],data.get('revision'))).rowcount
                if not changed: return self.reply(409, {'error':'A newer save exists in another tab. Reload to load it.'})
                return self.reply(200, {'revision':row[3]+1})
            return self.reply(404, {'error':'Not found'})

if __name__ == '__main__':
    print('Emoji Flight: http://127.0.0.1:18943', flush=True)
    ThreadingHTTPServer(('127.0.0.1',18943), Handler).serve_forever()
