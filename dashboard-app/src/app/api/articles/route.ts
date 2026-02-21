import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
    try {
        // Resolve path to .tmp/all_articles.json relative to the repo root
        // dashboard-app/ is one level inside testing123/, so we go up one level
        const filePath = path.resolve(
            process.cwd(),
            "..",
            ".tmp",
            "all_articles.json"
        );

        const raw = await readFile(filePath, "utf-8");
        const data = JSON.parse(raw);

        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        // Return a valid empty response instead of crashing
        return NextResponse.json(
            {
                scraped_at: new Date().toISOString(),
                window_hours: 24,
                article_count: 0,
                sources: { bens_bites: 0, rundown_ai: 0 },
                articles: [],
                error: "Could not load articles. Run python3 tools/run_scrapers.py first.",
            },
            { status: 200 }
        );
    }
}
