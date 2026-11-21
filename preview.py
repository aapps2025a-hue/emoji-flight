from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
root = Path(__file__).resolve().parent / 'public'
print('Emoji Flight with Firebase: http://127.0.0.1:18944/', flush=True)
ThreadingHTTPServer(('127.0.0.1',18944),partial(SimpleHTTPRequestHandler,directory=str(root))).serve_forever()
