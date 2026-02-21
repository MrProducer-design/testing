#!/usr/bin/env python3
"""
scrape_rundown.py
Layer 3 Tool — Scrapes The AI Rundown newsletter homepage + article pages.
Outputs articles from the last 24 hours to .tmp/rundown.json
"""

import json
import hashlib
import time
import sys
import os
import re
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError
from html.parser import HTMLParser

HOME_URL = "https://www.therundown.ai"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '.tmp')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'rundown.json')
ERROR_LOG = os.path.join(OUTPUT_DIR, 'errors.log')
WINDOW_HOURS = 48
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


def log_error(message: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(ERROR_LOG, 'a') as f:
        f.write(f"[{datetime.now(timezone.utc).isoformat()}] [rundown] {message}\n")
    print(f"  ⚠️  {message}", file=sys.stderr)


def make_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def fetch_url(url: str) -> str | None:
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except URLError as e:
        log_error(f"Failed to fetch {url}: {e}")
        return None


class ArticleLinkParser(HTMLParser):
    """Extract article slugs from The Rundown AI homepage."""
    def __init__(self):
        super().__init__()
        self.links = []
        self._in_article = False

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            attrs_dict = dict(attrs)
            href = attrs_dict.get('href', '')
            # Articles are at /p/[slug]
            if href and re.match(r'^/p/[a-z0-9\-]+$', href):
                full_url = f"{HOME_URL}{href}"
                if full_url not in self.links:
                    self.links.append(full_url)


class ArticleMetaParser(HTMLParser):
    """Extract title, date, and description from a Rundown article page."""
    def __init__(self):
        super().__init__()
        self.meta = {}
        self._current_tag = None
        self._current_attrs = {}
        self._body_dates = []  # collect all date-like strings found in body

    def handle_starttag(self, tag, attrs):
        self._current_tag = tag
        self._current_attrs = dict(attrs)
        if tag == 'meta':
            name = self._current_attrs.get('name') or self._current_attrs.get('property', '')
            content = self._current_attrs.get('content', '')
            if name in ('og:title', 'twitter:title') and 'title' not in self.meta:
                self.meta['title'] = content
            elif name in ('og:description', 'twitter:description', 'description') and 'description' not in self.meta:
                self.meta['description'] = content
            # Only use article:published_time if it looks like a current year
            elif name in ('article:published_time', 'og:article:published_time'):
                if content and '202' in content:  # sanity check year
                    self.meta['published_at_meta'] = content

    def handle_data(self, data):
        # Collect all date-like strings from body text — prioritize these over meta
        # Matches: "Feb 20, 2026" / "February 20, 2026" / "Feb 20 2026"
        date_matches = re.findall(
            r'(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
            r'\.?\s+(\d{1,2}),?\s+(20\d{2})',
            data.strip()
        )
        for m in date_matches:
            raw = f"{m[0]} {m[1]}, {m[2]}"
            self._body_dates.append(raw)

    def get_best_date(self):
        """Return the best date string found — prefer body text dates over meta."""
        if self._body_dates:
            return self._body_dates[0]  # first occurrence = publish date at top of article
        return self.meta.get('published_at_meta')


def parse_article_date(raw: str) -> datetime | None:
    """Try multiple date formats found in Rundown articles."""
    clean = raw.strip().rstrip(',')
    formats = [
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%d',
        '%b %d %Y',
        '%B %d %Y',
        '%b %d, %Y',
        '%B %d, %Y',
        '%b. %d %Y',
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(clean, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def scrape_article_metadata(url: str) -> dict | None:
    """Fetch an individual article and extract its metadata."""
    html = fetch_url(url)
    if not html:
        return None

    parser = ArticleMetaParser()
    try:
        parser.feed(html)
    except Exception as e:
        log_error(f"HTML parse error for {url}: {e}")
        return None

    meta = parser.meta
    best_date_raw = parser.get_best_date()
    title = meta.get('title', '').replace(' | The Rundown AI', '').strip()
    description = meta.get('description', '').strip()

    # Parse date
    pub_date = None
    if best_date_raw:
        pub_date = parse_article_date(best_date_raw)

    if not title:
        return None

    return {
        'title': title,
        'description': description[:300] + '...' if len(description) > 300 else description,
        'published_at': pub_date,
    }


def run() -> dict:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=WINDOW_HOURS)
    scraped_at = now.isoformat()
    articles = []

    print("  📡 Fetching The AI Rundown homepage...")
    html = fetch_url(HOME_URL)

    if html is None:
        result = {
            "scraped_at": scraped_at,
            "window_hours": WINDOW_HOURS,
            "article_count": 0,
            "articles": [],
            "error": "Failed to fetch homepage"
        }
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(result, f, indent=2)
        return result

    # Extract article links
    link_parser = ArticleLinkParser()
    try:
        link_parser.feed(html)
    except Exception as e:
        log_error(f"Failed to parse homepage links: {e}")

    article_urls = link_parser.links[:15]  # Check last 15 articles max
    print(f"  🔍 Found {len(article_urls)} candidate article links, checking dates...")

    for url in article_urls:
        try:
            meta = scrape_article_metadata(url)
            if not meta:
                continue

            pub_date = meta.get('published_at')

            # If no date found, assume it's recent (homepage shows latest)
            if pub_date is None:
                log_error(f"No date found for {url}, including with caution")
                pub_date = now  # assume current

            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)

            if pub_date < cutoff:
                print(f"  ⏭️  Skipping (outside {WINDOW_HOURS}h): {meta['title'][:50]}")
                continue

            articles.append({
                "id": make_id(url),
                "source": "rundown_ai",
                "source_label": "The AI Rundown",
                "title": meta['title'],
                "subtitle": None,
                "url": url,
                "published_at": pub_date.isoformat(),
                "summary": meta.get('description'),
                "tags": ["AI", "Tech"],
                "scraped_at": scraped_at,
            })

            time.sleep(0.5)  # Polite delay between article fetches

        except Exception as e:
            log_error(f"Unexpected error processing {url}: {e}")
            continue

    print(f"  ✅ Found {len(articles)} article(s) in last {WINDOW_HOURS}h")
    result = {
        "scraped_at": scraped_at,
        "window_hours": WINDOW_HOURS,
        "article_count": len(articles),
        "articles": articles,
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"  💾 Saved to {OUTPUT_FILE}")
    return result


if __name__ == "__main__":
    print("🟡 The AI Rundown Scraper")
    result = run()
    sys.exit(0 if 'error' not in result else 1)
