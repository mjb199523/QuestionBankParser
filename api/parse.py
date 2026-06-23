"""Vercel serverless function: Parse a .docx file into structured JSON."""

from __future__ import annotations

import json
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys
import os

# Add project root to path so we can import parser
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parser import parse_docx


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", 0))
        
        if "multipart/form-data" not in content_type:
            self._json(400, {"error": "Expected multipart/form-data"})
            return
        
        try:
            # Parse multipart form data manually
            import cgi
            environ = {
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
            }
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ=environ,
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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
