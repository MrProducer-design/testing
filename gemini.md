# 📜 gemini.md — Project Constitution
> **Law**: This file is authoritative. All schemas, rules, and architecture live here.
> Last Updated: 2026-02-21

---

## 🔖 Project Identity

| Field | Value |
|---|---|
| **Project Name** | AI News Dashboard |
| **North Star** | Beautiful interactive dashboard showing AI newsletter articles from last 24h, with save functionality and local persistence |
| **Status** | 🟡 Phase 2 — Link (Scraper Build) |
| **Protocol** | B.L.A.S.T. + A.N.T. 3-Layer Architecture |

---

## 📐 Data Schema

> ✅ LOCKED: Schema confirmed 2026-02-21.

### Article Object (per scraped item)
```json
{
  "id": "sha256-hash-of-url",
  "source": "bens_bites | rundown_ai",
  "title": "string",
  "subtitle": "string | null",
  "url": "string",
  "published_at": "ISO-8601 datetime string",
  "summary": "string | null",
  "tags": ["string"],
  "scraped_at": "ISO-8601 datetime string"
}
```

### Output File Shape (`.tmp/all_articles.json`)
```json
{
  "scraped_at": "ISO-8601 datetime",
  "window_hours": 24,
  "article_count": 3,
  "articles": ["...Article objects..."]
}
```

---

## 🏛️ Architectural Invariants

> These rules are permanent and may never be broken without explicit user approval.

1. **Data-First**: No tool code is written before the schema is confirmed.
2. **Atomic Tools**: Each script in `tools/` does one thing and one thing only.
3. **Deterministic Logic**: No guessing in Python scripts. All branching must be explicit.
4. **`.tmp/` is ephemeral**: Nothing in `.tmp/` is considered a deliverable.
5. **Cloud is truth**: A project is only "Complete" when the payload is in its final cloud destination.
6. **SOP before code**: If logic changes, update `architecture/` SOP before updating `tools/`.

---

## ⚙️ Behavioral Rules

> To be populated after Discovery Q5 is answered.

- (Pending)

---

## 🔌 Integrations

> To be populated after Discovery Q2 is answered.

| Service | Status | Key Location |
|---|---|---|
| Ben's Bites (Substack RSS) | ✅ Verified — no key needed | `bensbites.com/feed` |
| The AI Rundown (HTML scrape) | ✅ Verified — no key needed | `therundown.ai` |
| Supabase | 🔜 Future phase | `.env` — TBD |

---

## 📊 Maintenance Log

| Date | Change | Author |
|---|---|---|
| 2026-02-21 | Initial constitution created | System Pilot |
