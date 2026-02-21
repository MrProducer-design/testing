#!/usr/bin/env python3
"""
serve.py — Launch the AI News Dashboard locally.
Starts a simple HTTP server so the dashboard can load .tmp/all_articles.json
without CORS restrictions that occur with the file:// protocol.

Usage:
    python3 serve.py

Then open: http://localhost:8080
"""
import http.server
import webbrowser
import os
import threading

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format, *args):
        # Suppress request logs for cleanliness
        pass

    def end_headers(self):
        # Allow CORS for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


def open_browser():
    import time
    time.sleep(0.8)
    webbrowser.open(f'http://localhost:{PORT}')


if __name__ == '__main__':
    os.chdir(ROOT)
    print(f"\n🌐 AI News Dashboard")
    print(f"   Serving at: http://localhost:{PORT}")
    print(f"   Root:       {ROOT}")
    print(f"\n   Press Ctrl+C to stop\n")

    threading.Thread(target=open_browser, daemon=True).start()

    with http.server.HTTPServer(('', PORT), SilentHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped.")
