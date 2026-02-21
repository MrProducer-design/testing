#!/usr/bin/env python3
"""
run_scrapers.py
Layer 3 Tool — Orchestrator. Runs all newsletter scrapers and merges output.
Usage: python tools/run_scrapers.py
"""

import json
import sys
import os
from datetime import datetime, timezone

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '.tmp')
MERGED_FILE = os.path.join(OUTPUT_DIR, 'all_articles.json')

# Import individual scrapers
sys.path.insert(0, os.path.dirname(__file__))
import scrape_bens_bites
import scrape_rundown


def merge_and_dedup(results: list[dict]) -> list[dict]:
    """Merge article lists, deduplicate by URL, sort by date descending."""
    seen_ids = set()
    merged = []
    for r in results:
        for article in r.get('articles', []):
            if article['id'] not in seen_ids:
                seen_ids.add(article['id'])
                merged.append(article)

    # Sort by published_at descending (newest first)
    def sort_key(a):
        try:
            return a.get('published_at', '1970-01-01T00:00:00+00:00')
        except Exception:
            return '1970-01-01T00:00:00+00:00'

    merged.sort(key=sort_key, reverse=True)
    return merged


def run():
    print("\n🚀 AI News Dashboard — Scraper Orchestrator")
    print("=" * 50)
    now = datetime.now(timezone.utc)

    results = []

    print("\n📰 [1/2] Ben's Bites")
    bb_result = scrape_bens_bites.run()
    results.append(bb_result)

    print("\n📰 [2/2] The AI Rundown")
    rd_result = scrape_rundown.run()
    results.append(rd_result)

    print("\n🔀 Merging & deduplicating...")
    articles = merge_and_dedup(results)

    merged = {
        "scraped_at": now.isoformat(),
        "window_hours": 24,
        "article_count": len(articles),
        "sources": {
            "bens_bites": bb_result.get('article_count', 0),
            "rundown_ai": rd_result.get('article_count', 0),
        },
        "articles": articles,
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(MERGED_FILE, 'w') as f:
        json.dump(merged, f, indent=2)

    print(f"\n{'=' * 50}")
    print(f"✅ Complete!")
    print(f"   Total articles (last 24h): {len(articles)}")
    print(f"   Ben's Bites:      {bb_result.get('article_count', 0)}")
    print(f"   The AI Rundown:   {rd_result.get('article_count', 0)}")
    print(f"   Output:           {MERGED_FILE}")
    print(f"{'=' * 50}\n")

    return merged


if __name__ == "__main__":
    result = run()
    sys.exit(0)
