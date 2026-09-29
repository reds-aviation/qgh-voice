import hashlib
import http.client
import importlib.util
import json
from functools import partial
from pathlib import Path
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location("atc_serve", Path(__file__).with_name("serve.py"))
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


class OfflineServerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        serve.ROOT = Path(self.temp.name)
        serve.SITE = serve.ROOT / "site"
        serve.SITE.mkdir()
        (serve.SITE / "index.html").write_text("ATC local home", encoding="utf-8")
        (serve.SITE / "app.js").write_text("const ready=true;", encoding="utf-8")
        (serve.SITE / "empty").mkdir()
        (serve.ROOT / "private.txt").write_text("must stay private", encoding="utf-8")
        files = [{"path": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                 for p in serve.SITE.iterdir() if p.is_file()]
        (serve.ROOT / "site-files.json").write_text(json.dumps({"release": "test", "files": files}), encoding="utf-8")
        self.server = serve.ThreadingHTTPServer(("127.0.0.1", 0), partial(serve.LocalHandler, directory=str(serve.SITE)))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, path, host=None, method="GET"):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request(method, path, headers={} if host is None else {"Host": host})
        response = connection.getresponse()
        result = (response.status, response.getheader("Content-Type"), response.read())
        connection.close()
        return result

    def test_local_assets_and_head(self):
        self.assertEqual(serve.verify_site(), ("test", 2))
        self.assertEqual(self.request("/")[2], b"ATC local home")
        self.assertEqual(self.request("/app.js?release=test")[:2], (200, "text/javascript"))
        self.assertEqual(self.request("/", method="HEAD")[2], b"")

    def test_reject_host_traversal_and_listing(self):
        self.assertEqual(self.request("/", host="external.invalid")[0], 403)
        self.assertEqual(self.request("/%2e%2e/private.txt")[0], 403)
        self.assertEqual(self.request("/..%5cprivate.txt")[0], 403)
        self.assertEqual(self.request("/empty/")[0], 403)

    def test_integrity_failure_prevents_start(self):
        (serve.SITE / "app.js").write_text("changed", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Changed file"):
            serve.verify_site()
        (serve.SITE / "app.js").unlink()
        with self.assertRaisesRegex(ValueError, "Missing or invalid file"):
            serve.verify_site()


if __name__ == "__main__":
    unittest.main()
