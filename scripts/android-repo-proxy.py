#!/usr/bin/env python3

from __future__ import annotations

import argparse
import http.server
import mimetypes
import pathlib
import shutil
import subprocess
import tempfile
import urllib.parse


ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT_DIR / '.tools' / 'maven-proxy-cache'

ROUTES = {
    'google': {
        'base_url': 'https://dl.google.com/dl/android/maven2',
        'host': 'dl.google.com',
        'ips': ['220.181.174.161'],
    },
    'maven': {
        'base_url': 'https://repo.maven.apache.org/maven2',
        'host': 'repo.maven.apache.org',
        'ips': ['104.18.18.12', '104.18.19.12'],
    },
}


def fetch_to_cache(route_name: str, relative_path: str, target_file: pathlib.Path) -> bool:
    route = ROUTES[route_name]
    target_file.parent.mkdir(parents=True, exist_ok=True)
    last_error = ''

    for ip in route['ips']:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_path = pathlib.Path(temp_file.name)

        command = [
            'curl',
            '--fail',
            '--silent',
            '--show-error',
            '--location',
            '--max-time',
            '60',
            '--resolve',
            f"{route['host']}:443:{ip}",
            '-o',
            str(temp_path),
            f"{route['base_url']}/{relative_path}",
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode == 0:
            shutil.move(str(temp_path), target_file)
            return True

        temp_path.unlink(missing_ok=True)
        if result.returncode == 22:
            continue
        last_error = result.stderr.strip()

    if last_error:
        raise RuntimeError(last_error)

    return False


class MavenProxyHandler(http.server.BaseHTTPRequestHandler):
    server_version = 'life-android-repo-proxy/0.1'

    def do_GET(self) -> None:  # noqa: N802
        self._handle_request(include_body=True)

    def do_HEAD(self) -> None:  # noqa: N802
        self._handle_request(include_body=False)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def _handle_request(self, include_body: bool) -> None:
        route_name, relative_path = self._parse_request_path()
        if route_name is None or relative_path is None:
            self.send_error(404, 'Not found')
            return

        cache_file = CACHE_DIR / route_name / relative_path

        try:
            if not cache_file.exists():
                fetched = fetch_to_cache(route_name, relative_path, cache_file)
                if not fetched:
                    self.send_error(404, 'Not found')
                    return
        except RuntimeError as error:
            self.send_error(502, 'Upstream fetch failed')
            return

        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(cache_file.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(cache_file.stat().st_size))
        self.end_headers()

        if include_body:
            with cache_file.open('rb') as file_handle:
                shutil.copyfileobj(file_handle, self.wfile)

    def _parse_request_path(self) -> tuple[str | None, str | None]:
        parsed = urllib.parse.urlparse(self.path)
        cleaned = urllib.parse.unquote(parsed.path).lstrip('/')
        if not cleaned:
            return None, None

        parts = pathlib.PurePosixPath(cleaned).parts
        if len(parts) < 2:
            return None, None

        route_name = parts[0]
        if route_name not in ROUTES:
            return None, None

        if any(part == '..' for part in parts[1:]):
            return None, None

        return route_name, '/'.join(parts[1:])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4873)
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), MavenProxyHandler)
    server.serve_forever()


if __name__ == '__main__':
    main()