"""Small dependency-free web server for the question paper parser."""

from __future__ import annotations

import cgi
import json
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from parser import parse_docx
from excel_export import create_xlsx


ROOT = Path(__file__).parent
WEB = ROOT / "web"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_POST(self):
        if self.path == "/api/export-excel":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                paper = json.loads(self.rfile.read(length).decode("utf-8"))
                filename, raw = create_xlsx(paper)
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            except Exception as error:
                self._json(400, {"error": str(error)})
            return
        if self.path != "/api/parse":
            self.send_error(404)
            return
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                },
            )
            item = form["file"]
            if not item.filename.lower().endswith(".docx"):
                raise ValueError("Please upload a .docx file.")
            with tempfile.TemporaryDirectory() as directory:
                temp = Path(directory) / "upload.docx"
                temp.write_bytes(item.file.read())
                payload = parse_docx(temp)
                payload["sourceFile"] = Path(item.filename).name
            self._json(200, payload)
        except Exception as error:
            self._json(400, {"error": str(error)})

    def _json(self, status: int, payload: dict):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def run(port: int = 8000):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Question Paper Parser running at http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
