"""Stable local origin for browser storage, with explicit handling of a busy port."""
import argparse
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import urllib.request
import webbrowser


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8041)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent
    identity=hashlib.sha256(str(root).casefold().encode()).hexdigest()
    marker='/__jocsjocs_instance__'
    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            super().end_headers()

        def do_GET(self):
            if self.path==marker:
                raw=json.dumps({'application':'JocsJocs','rootId':identity}).encode()
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(raw)))
                self.end_headers();self.wfile.write(raw)
            else:
                super().do_GET()

    url=f'http://127.0.0.1:{args.port}/'
    class LocalServer(ThreadingHTTPServer):
        # Windows SO_REUSEADDR permits a second listener on the same address.
        # Reserve it exclusively, so ownership detection below is reliable.
        allow_reuse_address=not hasattr(socket,'SO_EXCLUSIVEADDRUSE')

        def server_bind(self):
            if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
                self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
            super().server_bind()

    try:
        server=LocalServer(('127.0.0.1',args.port),partial(Handler,directory=str(root)))
    except OSError as error:
        try:
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(url.rstrip('/')+marker,timeout=2) as response:
                running=json.load(response)
            if running.get('application')=='JocsJocs' and running.get('rootId')==identity:
                print('Diese App läuft bereits: '+url)
                if not args.no_browser: webbrowser.open(url)
                return
        except (OSError,ValueError):
            pass
        raise SystemExit(f'Port {args.port} ist belegt. Bitte die andere lokale App schließen und erneut starten. Der Port bleibt fest, damit gespeicherte Abfragen wiedergefunden werden.') from error
    print('JocsJocs: '+url,flush=True)
    if not args.no_browser: webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__=='__main__':
    main()
