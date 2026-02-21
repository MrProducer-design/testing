"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────
interface Article {
    id: string;
    source: string;
    source_label: string;
    title: string;
    subtitle: string | null;
    url: string;
    published_at: string;
    summary: string | null;
    tags: string[];
    scraped_at: string;
}

interface ScraperOutput {
    scraped_at: string;
    window_hours: number;
    article_count: number;
    sources?: { bens_bites: number; rundown_ai: number };
    articles: Article[];
}

type Filter = "all" | "bens_bites" | "rundown_ai";
type ViewMode = "grid" | "list";
type NavView = "feed" | "saved";

// ── Helpers ────────────────────────────────────────────────
const STORAGE_KEY = "ainews_saved";
const DATA_KEY = "ainews_articles";
const META_KEY = "ainews_meta";

function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

function loadSavedIds(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function persistSavedIds(ids: Set<string>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

// ── Sub-components ─────────────────────────────────────────
function SourceBadge({ source, label }: { source: string; label: string }) {
    const isBB = source === "bens_bites";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border",
                isBB
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            )}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {label}
        </span>
    );
}

function SkeletonCard() {
    return (
        <div className="bg-[#141414] border border-white/7 rounded-2xl p-6 flex flex-col gap-4 animate-pulse">
            <div className="h-5 w-28 bg-white/5 rounded-full" />
            <div className="space-y-2">
                <div className="h-4 bg-white/5 rounded-md" />
                <div className="h-4 w-3/4 bg-white/5 rounded-md" />
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded-md" />
                <div className="h-3 w-5/6 bg-white/5 rounded-md" />
                <div className="h-3 w-2/3 bg-white/5 rounded-md" />
            </div>
            <div className="h-3 w-20 bg-white/5 rounded-md mt-auto" />
        </div>
    );
}

interface ArticleCardProps {
    article: Article;
    saved: boolean;
    onToggleSave: (id: string) => void;
    listMode?: boolean;
}

function ArticleCard({ article, saved, onToggleSave, listMode }: ArticleCardProps) {
    return (
        <div
            onClick={() => window.open(article.url, "_blank", "noopener")}
            className={cn(
                "group bg-[#141414] border border-white/7 rounded-2xl p-6 flex flex-col gap-4",
                "cursor-pointer transition-all duration-300 relative overflow-hidden",
                "hover:border-[#BFF549]/30 hover:bg-[#1a1a1a] hover:-translate-y-0.5",
                "hover:shadow-[0_12px_36px_rgba(0,0,0,0.4),0_0_0_1px_rgba(191,245,73,0.15)]",
                saved && "border-[#BFF549]/20",
                listMode && "flex-row items-start gap-6"
            )}
        >
            {/* top accent line on hover */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#BFF549] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className={cn("flex items-center justify-between gap-2", listMode && "flex-shrink-0")}>
                <SourceBadge source={article.source} label={article.source_label} />
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        title={saved ? "Unsave" : "Save"}
                        onClick={() => onToggleSave(article.id)}
                        className={cn(
                            "w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200",
                            saved
                                ? "border-[#BFF549]/40 text-[#BFF549] bg-[#BFF549]/10"
                                : "border-white/10 text-white/40 hover:border-[#BFF549]/40 hover:text-[#BFF549] hover:bg-[#BFF549]/10"
                        )}
                    >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                    </button>
                    <a
                        href={article.url} target="_blank" rel="noopener"
                        className="w-7 h-7 rounded-lg border border-white/10 text-white/40 flex items-center justify-center hover:border-[#BFF549]/40 hover:text-[#BFF549] transition-all duration-200"
                    >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                    </a>
                </div>
            </div>

            <div className={cn("flex flex-col gap-3", listMode && "flex-1")}>
                <h3 className="text-[15px] font-semibold leading-snug text-white/90 group-hover:text-white transition-colors tracking-[-0.2px]">
                    {article.title}
                </h3>
                {article.summary && (
                    <p className="text-[13px] text-white/50 leading-relaxed line-clamp-3">
                        {article.summary}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto">
                <span className="text-[11px] text-white/25 font-mono flex items-center gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    {formatDate(article.published_at)}
                </span>
                <div className="flex gap-1.5">
                    {article.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 font-mono">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────
export function NewsDashboard() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<Filter>("all");
    const [navView, setNavView] = useState<NavView>("feed");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [toast, setToast] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [sourceCounts, setSourceCounts] = useState({ bens_bites: 0, rundown_ai: 0 });
    const [error, setError] = useState(false);

    // Load saved IDs from localStorage
    useEffect(() => {
        setSavedIds(loadSavedIds());
    }, []);

    // Load cached articles on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(DATA_KEY);
            const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
            if (raw) {
                const arts: Article[] = JSON.parse(raw);
                setArticles(arts);
                setLastUpdated(meta.scraped_at || null);
                setSourceCounts({
                    bens_bites: arts.filter((a) => a.source === "bens_bites").length,
                    rundown_ai: arts.filter((a) => a.source === "rundown_ai").length,
                });
            }
        } catch { }
    }, []);

    const fetchArticles = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await fetch(`/api/articles?t=${Date.now()}`);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data: ScraperOutput = await res.json();

            setArticles(data.articles);
            setLastUpdated(data.scraped_at);
            setSourceCounts({
                bens_bites: data.sources?.bens_bites ?? data.articles.filter((a) => a.source === "bens_bites").length,
                rundown_ai: data.sources?.rundown_ai ?? data.articles.filter((a) => a.source === "rundown_ai").length,
            });
            setError(false);

            try {
                localStorage.setItem(DATA_KEY, JSON.stringify(data.articles));
                localStorage.setItem(META_KEY, JSON.stringify({ scraped_at: data.scraped_at }));
            } catch { }

            if (isManual) showToast(`✓ ${data.article_count} articles loaded`);
        } catch {
            setError(true);
            if (isManual) showToast("Could not refresh — showing cached data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchArticles(); }, [fetchArticles]);

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 2800);
    }

    function toggleSave(id: string) {
        setSavedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); showToast("Article removed"); }
            else { next.add(id); showToast("Article saved ✓"); }
            persistSavedIds(next);
            return next;
        });
    }

    // Derived
    const filteredArticles = articles
        .filter((a) => navView === "saved" ? savedIds.has(a.id) : true)
        .filter((a) => filter === "all" ? true : a.source === filter)
        .filter((a) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (a.title || "").toLowerCase().includes(q) || (a.summary || "").toLowerCase().includes(q);
        });

    const statTotal = articles.length;
    const statSaved = savedIds.size;

    return (
        <section className="bg-[#0D0D0D] min-h-screen" id="news-feed">
            {/* ── TOPBAR ── */}
            <header className="sticky top-0 z-50 flex items-center gap-4 px-8 h-16 border-b border-white/7 bg-[#0D0D0D]/85 backdrop-blur-xl">
                <div className="text-[17px] font-semibold tracking-tight flex-1">
                    AI <span className="text-[#BFF549]">News</span> Feed
                </div>

                {/* Search */}
                <div className="flex items-center gap-2.5 bg-[#141414] border border-white/7 rounded-xl px-3.5 py-2 w-64 focus-within:border-[#BFF549]/30 transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A7A7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        className="bg-transparent outline-none text-[13px] text-white/80 placeholder-white/30 w-full"
                        placeholder="Search articles…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Refresh */}
                <button
                    disabled={refreshing}
                    onClick={() => fetchArticles(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#BFF549] text-[#0D0D0D] text-[13px] font-semibold rounded-lg hover:opacity-85 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg
                        className={cn("w-3.5 h-3.5", refreshing && "animate-spin")}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Refresh
                </button>
            </header>

            <div className="flex">
                {/* ── SIDEBAR ── */}
                <aside className="w-[72px] min-h-[calc(100vh-64px)] border-r border-white/7 flex flex-col items-center py-6 gap-2 sticky top-16 self-start">
                    {/* Feed */}
                    <button
                        onClick={() => setNavView("feed")}
                        className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all relative",
                            navView === "feed" ? "bg-[#BFF549]/12 text-[#BFF549]" : "text-white/30 hover:text-white/60 hover:bg-white/5"
                        )}
                    >
                        {navView === "feed" && <span className="absolute -left-px w-0.5 h-6 bg-[#BFF549] rounded-r-full" />}
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                    </button>
                    {/* Saved */}
                    <button
                        onClick={() => setNavView("saved")}
                        className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all relative",
                            navView === "saved" ? "bg-[#BFF549]/12 text-[#BFF549]" : "text-white/30 hover:text-white/60 hover:bg-white/5"
                        )}
                    >
                        {navView === "saved" && <span className="absolute -left-px w-0.5 h-6 bg-[#BFF549] rounded-r-full" />}
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                    </button>
                    <div className="mt-auto">
                        <button className="w-11 h-11 rounded-xl flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-all">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        </button>
                    </div>
                </aside>

                {/* ── CONTENT ── */}
                <div className="flex-1 px-8 py-7">
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-7">
                        {[
                            { label: "Total Articles", value: statTotal, sub: "last 24 hours", accent: true },
                            { label: "Ben's Bites", value: sourceCounts.bens_bites, sub: "bensbites.com" },
                            { label: "AI Rundown", value: sourceCounts.rundown_ai, sub: "therundown.ai" },
                            { label: "Saved", value: statSaved, sub: "bookmarked" },
                        ].map((s) => (
                            <div key={s.label} className="bg-[#141414] border border-white/7 rounded-2xl p-5 flex flex-col gap-2 hover:border-[#BFF549]/20 transition-colors">
                                <div className="text-[11px] text-white/35 uppercase tracking-widest font-medium">{s.label}</div>
                                <div className={cn("text-3xl font-bold tracking-tight", s.accent ? "text-[#BFF549]" : "text-white")}>{loading ? "—" : s.value}</div>
                                <div className="text-[11px] text-white/25 font-mono">{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filter bar */}
                    <div className="flex items-center gap-2.5 mb-5 flex-wrap">
                        <span className="text-[11px] text-white/30 uppercase tracking-widest font-medium mr-1">Filter</span>
                        {(["all", "bens_bites", "rundown_ai"] as Filter[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-full border text-[13px] transition-all",
                                    filter === f
                                        ? "bg-[#BFF549]/12 border-[#BFF549]/30 text-[#BFF549]"
                                        : "border-white/10 text-white/40 hover:border-[#BFF549]/25 hover:text-[#BFF549]/80"
                                )}
                            >
                                {f === "all" ? "All" : f === "bens_bites" ? "Ben's Bites" : "AI Rundown"}
                            </button>
                        ))}
                        <div className="ml-auto flex gap-2">
                            {(["grid", "list"] as ViewMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setViewMode(m)}
                                    className={cn(
                                        "w-8 h-8 rounded-lg border flex items-center justify-center transition-all",
                                        viewMode === m ? "bg-[#BFF549]/12 border-[#BFF549]/30 text-[#BFF549]" : "border-white/10 text-white/30 hover:text-white/60"
                                    )}
                                >
                                    {m === "grid"
                                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                                    }
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Articles */}
                    {loading ? (
                        <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-[repeat(auto-fill,minmax(340px,1fr))]" : "grid-cols-1")}>
                            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : error && articles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                            <div className="w-14 h-14 bg-[#141414] border border-white/7 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
                            <div className="text-lg font-semibold text-white/80">Run the scraper first</div>
                            <div className="text-[13px] text-white/40 max-w-xs leading-relaxed">
                                No data found. Fetch fresh articles by running:
                            </div>
                            <code className="bg-[#BFF549]/10 text-[#BFF549] px-4 py-2 rounded-lg text-[13px] font-mono">
                                python3 tools/run_scrapers.py
                            </code>
                        </div>
                    ) : filteredArticles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                            <div className="w-14 h-14 bg-[#141414] border border-white/7 rounded-2xl flex items-center justify-center text-2xl">
                                {navView === "saved" ? "🔖" : "🔍"}
                            </div>
                            <div className="text-lg font-semibold text-white/80">
                                {navView === "saved" ? "No saved articles" : "No results"}
                            </div>
                            <div className="text-[13px] text-white/40">
                                {navView === "saved" ? "Click the bookmark icon on any article to save it here." : "Try a different filter or search term."}
                            </div>
                        </div>
                    ) : (
                        <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-[repeat(auto-fill,minmax(340px,1fr))]" : "grid-cols-1")}>
                            {filteredArticles.map((a) => (
                                <ArticleCard
                                    key={a.id}
                                    article={a}
                                    saved={savedIds.has(a.id)}
                                    onToggleSave={toggleSave}
                                    listMode={viewMode === "list"}
                                />
                            ))}
                        </div>
                    )}

                    {/* Last updated */}
                    {lastUpdated && !loading && (
                        <p className="text-center text-[11px] text-white/20 font-mono mt-8 pb-4">
                            Last updated {formatDate(lastUpdated)} · {articles.length} article{articles.length !== 1 ? "s" : ""} in last 24h
                        </p>
                    )}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-7 right-7 bg-[#141414] border border-[#BFF549]/30 rounded-xl px-4 py-3 flex items-center gap-2.5 text-[13px] font-medium z-50 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#BFF549]" />
                    {toast}
                </div>
            )}
        </section>
    );
}
