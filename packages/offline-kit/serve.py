"""ATC Training Suite: standard-library-only, loopback file server."""
import argparse
import hashlib
import json
import mimetypes
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import webbrowser

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"


def verify_site():
    manifest = json.loads((ROOT / "site-files.json").read_text(encoding="utf-8"))
    for item in manifest["files"]:
        file = (SITE / item["path"]).resolve()
        if not file.is_relative_to(SITE.resolve()) or not file.is_file():
            raise ValueError("Missing or invalid file: " + item["path"])
        if hashlib.sha256(file.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError("Changed file: " + item["path"])
    return manifest["release"], len(manifest["files"])


class LocalHandler(SimpleHTTPRequestHandler):
    extensions_map = {**mimetypes.types_map, ".js": "text/javascript", ".mjs": "text/javascript",
                      ".wasm": "application/wasm", ".json": "application/json",
                      ".webmanifest": "application/manifest+json", ".ttf": "font/ttf"}

    def do_GET(self):
        host = self.headers.get("Host", "")
        if host not in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"):
            self.send_error(403, "Only the local training address is allowed")
            return
        path = (SITE / unquote(urlsplit(self.path).path).lstrip("/\\")).resolve()
        if not path.is_relative_to(SITE.resolve()):
            self.send_error(403, "Outside the training site")
            return
        super().do_GET()

    def do_HEAD(self):
        # Apply the same host and path checks; suppress the response body.
        self._head_only = True
        self.do_GET()

    def copyfile(self, source, outputfile):
        if not getattr(self, "_head_only", False):
            super().copyfile(source, outputfile)

    def list_directory(self, path):
        self.send_error(403, "Directory listing is disabled")
        return None

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--check", action="store_true", help="Verify files and exit")
    options = parser.parse_args()
    if not 1024 <= options.port <= 65535:
        parser.error("Port must be 1024-65535")
    try:
        release, count = verify_site()
        print(f"ATC Training Suite {release}: {count} site files verified.", flush=True)
        if options.check:
            return
        server = ThreadingHTTPServer(("127.0.0.1", options.port), partial(LocalHandler, directory=str(SITE)))
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(f"Cannot start ATC: {error}\nSee START-HERE.txt. Nothing has been changed.")
    url = f"http://127.0.0.1:{options.port}/"
    print(f"Open {url}\nKeep this window open. Ctrl+C stops the server.\nThis PC only; no internet or classroom network is used.", flush=True)
    if not options.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nATC server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
