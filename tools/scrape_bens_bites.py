#!/usr/bin/env python3
"""
scrape_bens_bites.py
Layer 3 Tool — Scrapes Ben's Bites via Substack RSS feed.
Outputs articles from the last 24 hours to .tmp/bens_bites.json
"""

import json
import hashlib
import time
import sys
import os
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

RSS_URL = "https://www.bensbites.com/feed"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '.tmp')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'bens_bites.json')
ERROR_LOG = os.path.join(OUTPUT_DIR, 'errors.log')
WINDOW_HOURS = 48


class HTMLStripper(HTMLParser):
    """Strip HTML tags from summary content."""
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return ' '.join(self.fed).strip()


def strip_html(html_string: str) -> str:
    s = HTMLStripper()
    s.feed(html_string or '')
    text = s.get_data()
    # Truncate to 300 characters for clean summary
    return text[:300] + '...' if len(text) > 300 else text


def log_error(message: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(ERROR_LOG, 'a') as f:
        f.write(f"[{datetime.now(timezone.utc).isoformat()}] [bens_bites] {message}\n")
    print(f"  ⚠️  {message}", file=sys.stderr)


def make_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def parse_rss_date(date_str: str) -> datetime | None:
    """Parse RFC 2822 date format used in RSS feeds."""
    formats = [
        '%a, %d %b %Y %H:%M:%S %z',
        '%a, %d %b %Y %H:%M:%S %Z',
        '%d %b %Y %H:%M:%S %z',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def fetch_rss() -> str | None:
    headers = {
        'User-Agent': 'Mozilla/5.0 (AI-News-Dashboard/1.0; research)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
    }
    req = Request(RSS_URL, headers=headers)
    try:
        with urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except URLError as e:
        log_error(f"Failed to fetch RSS: {e}")
        return None


def parse_articles(xml_content: str, cutoff: datetime) -> list[dict]:
    articles = []
    scraped_at = datetime.now(timezone.utc).isoformat()

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        log_error(f"Failed to parse XML: {e}")
        return []

    # Handle namespaces
    ns = {'content': 'http://purl.org/rss/1.0/modules/content/'}
    channel = root.find('channel')
    if channel is None:
        log_error("No <channel> found in RSS feed")
        return []

    for item in channel.findall('item'):
        try:
            title_el = item.find('title')
            link_el = item.find('link')
            desc_el = item.find('description')
            date_el = item.find('pubDate')
            category_els = item.findall('category')

            title = title_el.text.strip() if title_el is not None and title_el.text else None
            url = link_el.text.strip() if link_el is not None and link_el.text else None
            description = desc_el.text if desc_el is not None else None
            date_str = date_el.text if date_el is not None else None
            tags = [c.text.strip() for c in category_els if c.text]

            if not title or not url:
                continue

            pub_date = parse_rss_date(date_str) if date_str else None
            if pub_date is None:
                log_error(f"Could not parse date '{date_str}' for article: {title[:40]}")
                continue

            # Ensure timezone-aware comparison
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)

            if pub_date < cutoff:
                continue  # Outside 24h window

            summary = strip_html(description) if description else None

            articles.append({
                "id": make_id(url),
                "source": "bens_bites",
                "source_label": "Ben's Bites",
                "title": title,
                "subtitle": None,
                "url": url,
                "published_at": pub_date.isoformat(),
                "summary": summary,
                "tags": tags,
                "scraped_at": scraped_at,
            })

        except Exception as e:
            log_error(f"Error processing item: {e}")
            continue

        time.sleep(0.1)  # Polite delay

    return articles


def run() -> dict:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=WINDOW_HOURS)
    scraped_at = now.isoformat()

    print("  📡 Fetching Ben's Bites RSS feed...")
    xml_content = fetch_rss()

    if xml_content is None:
        result = {
            "scraped_at": scraped_at,
            "window_hours": WINDOW_HOURS,
            "article_count": 0,
            "articles": [],
            "error": "Failed to fetch RSS feed"
        }
    else:
        print("  🔍 Parsing articles...")
        articles = parse_articles(xml_content, cutoff)
        result = {
            "scraped_at": scraped_at,
            "window_hours": WINDOW_HOURS,
            "article_count": len(articles),
            "articles": articles
        }
        print(f"  ✅ Found {len(articles)} article(s) in last {WINDOW_HOURS}h")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"  💾 Saved to {OUTPUT_FILE}")
    return result


if __name__ == "__main__":
    print("🟡 Ben's Bites Scraper")
    result = run()
    sys.exit(0 if 'error' not in result else 1)
