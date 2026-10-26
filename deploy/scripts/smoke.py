"""Read-only HTTP checks; does not register users or create orders."""
import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen
from xml.etree import ElementTree


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://zapchast.king.tj")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    parts = urlsplit(base)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.path:
        parser.error("base-url must be an HTTP(S) origin")

    paths = {
        "/": "html",
        "/catalog": "html",
        "/health": "health",
        "/ready": "ready",
        "/api/v1/catalog/categories": "json",
        "/api/v1/catalog/brands": "json",
        "/api/v1/catalog/products": "json",
        "/api/v1/content/articles": "json",
        "/api/v1/seo/meta": "meta",
        "/sitemap.xml": "xml",
        "/robots.txt": "robots",
    }
    failures = 0
    for path, kind in paths.items():
        try:
            with urlopen(base + path, timeout=20) as response:
                if response.status != 200:
                    raise ValueError(f"Expected 200, got {response.status}")
                body = response.read().decode("utf-8")
                content_type = response.headers.get("Content-Type", "")
                if kind in {"json", "health", "ready", "meta"}:
                    if "application/json" not in content_type:
                        raise ValueError("Expected JSON content type")
                    data = json.loads(body)
                    if kind in {"health", "ready"} and data.get("status") != {"health": "ok", "ready": "ready"}[kind]:
                        raise ValueError("Unexpected health status")
                    if kind == "meta" and data.get("site_url") != base:
                        raise ValueError("SEO origin differs from deployment origin")
                elif kind == "html":
                    if "text/html" not in content_type or 'id="root"' not in body:
                        raise ValueError("React HTML entry point missing")
                elif kind == "xml":
                    sitemap = ElementTree.fromstring(body)
                    urls = sitemap.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url")
                    if not urls:
                        raise ValueError("Sitemap is empty")
                    for url in urls:
                        location = url.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}loc", "")
                        if not location.startswith(base + "/"):
                            raise ValueError("Sitemap points to another origin")
                elif kind == "robots" and f"Sitemap: {base}/sitemap.xml" not in body:
                    raise ValueError("robots.txt sitemap origin differs")
            print(f"OK {path}")
        except (HTTPError, URLError, TimeoutError, ValueError, ElementTree.ParseError) as exc:
            failures += 1
            print(f"FAIL {path}: {exc}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
