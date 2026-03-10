"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, RefreshCw, ScrollText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ───────────────────────────────────────────────────────────

interface LogEntry {
  time: string;
  level: string;
  source: string;
  category?: string;
  message: string;
  data?: Record<string, unknown>;
}

interface LogResponse {
  entries: LogEntry[];
  hasMore: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, { badge: string; text: string }> = {
  error: { badge: "bg-red-500/20 text-red-400", text: "text-red-400" },
  warn: { badge: "bg-amber-500/20 text-amber-400", text: "text-amber-400" },
  info: { badge: "bg-blue-500/20 text-blue-400", text: "text-blue-400" },
  debug: { badge: "bg-zinc-500/20 text-zinc-500", text: "text-zinc-500" },
};

const SOURCE_LABELS: Record<string, string> = {
  gateway: "GW",
  fileserver: "FS",
};

const LEVELS = ["error", "warn", "info", "debug"] as const;
const SOURCES = [
  { value: "", label: "All" },
  { value: "gateway", label: "Gateway" },
  { value: "fileserver", label: "File Server" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms}`;
  }
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = months[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mon} ${dd} ${hh}:${mm}:${ss}`;
}

function hasData(data?: Record<string, unknown>): boolean {
  return !!data && Object.keys(data).length > 0;
}

// ── Component ───────────────────────────────────────────────────────

export function LogClient() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [source, setSource] = useState("");
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Expanded entries (by index)
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // ── Fetch logs ──────────────────────────────────────────────────

  const fetchLogs = useCallback(
    async (opts?: { before?: string; after?: string; append?: boolean; prepend?: boolean }) => {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (activeLevels.size > 0) {
        // Send each active level
        for (const lvl of activeLevels) {
          params.append("level", lvl);
        }
      }
      if (searchQuery) params.set("search", searchQuery);
      if (opts?.before) params.set("before", opts.before);
      if (opts?.after) params.set("after", opts.after);
      params.set("limit", "100");

      try {
        const res = await fetch(`/api/logs?${params.toString()}`);
        if (!res.ok) return;
        const data: LogResponse = await res.json();

        if (opts?.append) {
          setEntries((prev) => [...prev, ...data.entries]);
          setHasMore(data.hasMore);
        } else if (opts?.prepend && data.entries.length > 0) {
          setEntries((prev) => [...data.entries, ...prev]);
        } else if (!opts?.append && !opts?.prepend) {
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setExpanded(new Set());
        }
      } catch {
        // silently fail on network errors
      }
    },
    [source, activeLevels, searchQuery]
  );

  // ── Initial fetch + filter changes ────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) setLoading(true);
      await fetchLogs();
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [fetchLogs]);

  // ── Debounced search ──────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ── Auto-refresh ──────────────────────────────────────────────

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!autoRefresh) return;

    intervalRef.current = setInterval(() => {
      setEntries((prev) => {
        if (prev.length > 0) {
          fetchLogs({ after: prev[0].time, prepend: true });
        } else {
          fetchLogs();
        }
        return prev;
      });
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleRefresh = () => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  };

  const handleLoadMore = () => {
    if (entries.length === 0) return;
    const oldest = entries[entries.length - 1].time;
    setLoadingMore(true);
    fetchLogs({ before: oldest, append: true }).finally(() =>
      setLoadingMore(false)
    );
  };

  const toggleLevel = (level: string) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const toggleExpand = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-zinc-800">
        {/* Source filter */}
        <div className="flex items-center gap-1">
          {SOURCES.map((s) => (
            <Button
              key={s.value}
              variant={source === s.value ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setSource(s.value)}
              className={
                source === s.value
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }
            >
              {s.label}
            </Button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700" />

        {/* Level filters */}
        <div className="flex items-center gap-1">
          {LEVELS.map((lvl) => {
            const active = activeLevels.has(lvl);
            const style = LEVEL_STYLES[lvl];
            return (
              <Button
                key={lvl}
                variant="ghost"
                size="xs"
                onClick={() => toggleLevel(lvl)}
                className={
                  active
                    ? `${style.badge} hover:opacity-80`
                    : "text-zinc-500 hover:text-zinc-300"
                }
              >
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </Button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700" />

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search logs..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-7 text-xs bg-zinc-900 border-zinc-700"
          />
        </div>

        {/* Refresh + Auto-refresh */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleRefresh}
            className="text-zinc-400 hover:text-zinc-200"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant={autoRefresh ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setAutoRefresh((v) => !v)}
            className={
              autoRefresh
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "text-zinc-500 hover:text-zinc-300"
            }
            title={autoRefresh ? "Auto-refresh ON (5s)" : "Auto-refresh OFF"}
          >
            Auto
          </Button>
        </div>
      </div>

      {/* ── Log entries ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading logs...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500">
            <ScrollText className="h-12 w-12" />
            <p className="text-sm">No log entries found</p>
          </div>
        ) : (
          <div className="font-mono text-xs">
            {entries.map((entry, i) => {
              const isExpanded = expanded.has(i);
              const style = LEVEL_STYLES[entry.level] || LEVEL_STYLES.debug;
              const srcLabel = SOURCE_LABELS[entry.source] || entry.source;
              const showData = hasData(entry.data);

              return (
                <div key={`${entry.time}-${i}`}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(i)}
                    className="w-full text-left px-4 py-1.5 hover:bg-zinc-800/50 flex items-start gap-2 cursor-pointer transition-colors"
                  >
                    {/* Expand indicator */}
                    <span className="mt-0.5 text-zinc-600 shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </span>

                    {/* Timestamp */}
                    <span className="text-zinc-500 shrink-0 w-[90px]">
                      {formatTimestamp(entry.time)}
                    </span>

                    {/* Level badge */}
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase leading-none ${style.badge}`}
                    >
                      {entry.level}
                    </span>

                    {/* Source badge */}
                    <span className="shrink-0 px-1 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 leading-none">
                      {srcLabel}
                    </span>

                    {/* Category */}
                    {entry.category && (
                      <span className="shrink-0 text-zinc-600 text-[10px]">
                        {entry.category}
                      </span>
                    )}

                    {/* Message */}
                    <span
                      className={`text-zinc-300 ${isExpanded ? "" : "truncate"} min-w-0`}
                    >
                      {entry.message}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="pl-[130px] pr-4 pb-2 text-zinc-400">
                      <p className="whitespace-pre-wrap break-all text-zinc-300 mb-1">
                        {entry.message}
                      </p>
                      {showData && (
                        <pre className="mt-1 p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 overflow-x-auto text-[11px] leading-relaxed">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
