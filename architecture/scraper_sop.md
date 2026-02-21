# SOP: Newsletter Scraper
> Layer 1 — Architecture Document
> Updated: 2026-02-21

## Goal
Collect the latest articles from Ben's Bites and The AI Rundown published within the last 24 hours, outputting structured JSON to `.tmp/`.

## Sources

### Ben's Bites
- **Type**: Substack RSS Feed
- **URL**: `https://www.bensbites.com/feed`
- **Method**: Parse RSS/XML with `feedparser` or stdlib `xml.etree`
- **Date Field**: `<pubDate>` in RSS item
- **Content**: `<title>`, `<link>`, `<description>` (summary HTML)

### The AI Rundown
- **Type**: HTML page scraping
- **URL**: `https://www.therundown.ai`
- **Method**: `requests` + `BeautifulSoup`
- **Article pages**: `https://www.therundown.ai/p/[slug]`
- **Date**: Extracted from article page meta or visible date string

## Error Handling Rules
1. If RSS fetch fails → log to `.tmp/errors.log`, return empty list (do NOT crash)
2. If date cannot be parsed → skip article, log warning
3. If article title/url is missing → skip silently
4. Never crash `run_scrapers.py` — always write a valid JSON file even if empty

## Rate Limits
- Ben's Bites: No known limit. Add 1s delay between requests to be safe.
- The AI Rundown: No known limit. Fetch homepage once, then individual articles.

## Constraints
- 24-hour window is calculated from script execution time (UTC)
- Output IDs are SHA-256 of the article URL (deterministic, dedup-safe)
- `.tmp/` is ephemeral — never commit to source control
