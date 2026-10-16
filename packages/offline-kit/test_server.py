# The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
# Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
# The Original Code is ATS SIM BOX.
# The Original Developer is the Initial Developer.
# The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
# Contributor(s): None designated in this initial notice.
# No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.

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
