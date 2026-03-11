"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, RefreshCw, ScrollText, ChevronDown, ChevronRight, Loader2, Play, Pause, Copy, Check } from "lucide-react";
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

const LEVEL_BORDER: Record<string, string> = {
  error: "border-l-[3px] border-red-500",
  warn: "border-l-[3px] border-amber-500",
  info: "border-l-[3px] border-blue-500",
  debug: "border-l-[3px] border-zinc-600",
};

const LEVEL_FILTER_STYLES: Record<string, { active: string; inactive: string }> = {
  error: { active: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40", inactive: "bg-zinc-800/50 text-zinc-600" },
  warn: { active: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40", inactive: "bg-zinc-800/50 text-zinc-600" },
  info: { active: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40", inactive: "bg-zinc-800/50 text-zinc-600" },
  debug: { active: "bg-zinc-700/50 text-zinc-300 ring-1 ring-zinc-500/40", inactive: "bg-zinc-800/50 text-zinc-600" },
};

const SOURCE_STYLES: Record<string, string> = {
  gateway: "text-purple-400",
  fileserver: "text-cyan-400",
  "moby-dock": "text-emerald-400",
};

const LEVELS = ["error", "warn", "info", "debug"] as const;
const SOURCES = [
  { value: "", label: "All" },
  { value: "gateway", label: "Gateway" },
  { value: "fileserver", label: "File Server" },
  { value: "moby-dock", label: "Moby Dock" },
] as const;

const TIME_RANGES = [
  { label: "Last 5m", value: 5 * 60 * 1000 },
  { label: "Last 15m", value: 15 * 60 * 1000 },
  { label: "Last 1h", value: 60 * 60 * 1000 },
  { label: "Last 6h", value: 6 * 60 * 60 * 1000 },
  { label: "Last 24h", value: 24 * 60 * 60 * 1000 },
  { label: "Last 7d", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "All", value: 0 },
] as const;

const DEFAULT_RANGE_INDEX = 2; // "Last 1h"

// ── Helpers ─────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const mon = MONTHS[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${mon} ${dd} ${hh}:${mm}:${ss}.${ms}`;
}

function formatMessage(message: string): React.ReactNode {
  // Highlight key=value pairs — only when preceded by start-of-string or whitespace
  // This avoids matching inside URLs like /logs?level=error
  const parts = message.split(/((?:^|\s)\w+=\S+)/g);
  return parts.map((part, i) => {
    const match = part.match(/^(\s?)(\w+)=(\S+)$/);
    if (match) {
      const [, ws, key, val] = match;
      return (
        <span key={i}>
          {ws}
          <span className="text-zinc-500">{key}=</span>
          <span className="text-zinc-200 font-medium">{val}</span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function hasData(data?: Record<string, unknown>): boolean {
  return !!data && Object.keys(data).length > 0;
}

// ── Copy JSON button ────────────────────────────────────────────────

function CopyJsonButton({ json }: { json: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 opacity-0 group-hover/json:opacity-100 transition-opacity"
      title="Copy JSON"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Component ───────────────────────────────────────────────────────

export function LogClient() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Filters
  const [source, setSource] = useState("");
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set(["error", "warn", "info"]));
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timeRangeIndex, setTimeRangeIndex] = useState(DEFAULT_RANGE_INDEX);

  // Expanded entries (by index) — only for data JSON
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Track newly added entries for animation
  const [newEntryKeys, setNewEntryKeys] = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // ── Fetch logs ──────────────────────────────────────────────────

  const fetchLogs = useCallback(
    async (opts?: { before?: string; after?: string; append?: boolean; prepend?: boolean }) => {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (activeLevels.size > 0) {
        params.set("level", Array.from(activeLevels).join(","));
      }
      if (searchQuery) params.set("search", searchQuery);
      if (opts?.before) params.set("before", opts.before);

      // Time range — compute "after" unless an explicit after is given (prepend)
      if (opts?.after) {
        params.set("after", opts.after);
      } else {
        const range = TIME_RANGES[timeRangeIndex];
        if (range.value > 0) {
          params.set("after", new Date(Date.now() - range.value).toISOString());
        }
      }

      params.set("limit", "100");

      const fetchErrors: string[] = [];
      try {
        // Determine which endpoints to fetch from
        const fetchLocal = !source || source === "gateway" || source === "fileserver";
        const fetchAxiom = !source || source === "moby-dock";

        const promises: Promise<LogResponse | null>[] = [];

        if (fetchLocal) {
          promises.push(
            fetch(`/api/logs?${params.toString()}`)
              .then(async (r) => {
                if (!r.ok) {
                  const body = await r.text().catch(() => "");
                  fetchErrors.push(`Local logs: ${r.status} ${body.slice(0, 100)}`);
                  return null;
                }
                return r.json();
              })
              .catch((e) => { fetchErrors.push(`Local logs: ${String(e)}`); return null; })
          );
        }

        if (fetchAxiom) {
          // Build Axiom params (no source param needed)
          const axiomParams = new URLSearchParams();
          if (activeLevels.size > 0) axiomParams.set("level", Array.from(activeLevels).join(","));
          if (searchQuery) axiomParams.set("search", searchQuery);
          if (opts?.before) axiomParams.set("before", opts.before);
          if (opts?.after) {
            axiomParams.set("after", opts.after);
          } else {
            const range = TIME_RANGES[timeRangeIndex];
            if (range.value > 0) {
              axiomParams.set("after", new Date(Date.now() - range.value).toISOString());
            }
          }
          axiomParams.set("limit", "100");

          promises.push(
            fetch(`/api/logs/axiom?${axiomParams.toString()}`)
              .then(async (r) => {
                if (!r.ok) {
                  const body = await r.text().catch(() => "");
                  fetchErrors.push(`Axiom: ${r.status} ${body.slice(0, 100)}`);
                  return null;
                }
                return r.json();
              })
              .catch((e) => { fetchErrors.push(`Axiom: ${String(e)}`); return null; })
          );
        }

        const results = await Promise.all(promises);

        // Merge entries from all sources
        let merged: LogEntry[] = [];
        let anyHasMore = false;
        for (const r of results) {
          if (r) {
            merged.push(...r.entries);
            if (r.hasMore) anyHasMore = true;
          }
        }

        // Sort by time descending
        merged.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        // Limit to 200 total
        if (merged.length > 200) {
          merged = merged.slice(0, 200);
          anyHasMore = true;
        }

        const data: LogResponse = { entries: merged, hasMore: anyHasMore };

        // Surface any fetch errors
        if (!opts?.prepend) {
          setErrors(fetchErrors);
        }

        if (opts?.append) {
          setEntries((prev) => [...prev, ...data.entries]);
          setHasMore(data.hasMore);
        } else if (opts?.prepend && data.entries.length > 0) {
          // Track new entry IDs for animation
          const newKeys = new Set(data.entries.map((e, j) => `${e.time}-new-${j}`));
          setNewEntryKeys(newKeys);
          setTimeout(() => setNewEntryKeys(new Set()), 1500);
          // Merge and re-sort to maintain timestamp order
          setEntries((prev) => {
            const combined = [...data.entries, ...prev];
            combined.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return combined;
          });
        } else if (!opts?.append && !opts?.prepend) {
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setExpanded(new Set());
        }
      } catch (e) {
        setErrors([`Unexpected error: ${String(e)}`]);
      }
    },
    [source, activeLevels, searchQuery, timeRangeIndex]
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
            const style = LEVEL_FILTER_STYLES[lvl];
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => toggleLevel(lvl)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  active
                    ? style.active
                    : style.inactive
                }`}
              >
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700" />

        {/* Time range picker */}
        <select
          value={timeRangeIndex}
          onChange={(e) => setTimeRangeIndex(Number(e.target.value))}
          className="h-7 px-2 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 appearance-none cursor-pointer [&>option]:bg-zinc-900 [&>option]:text-zinc-300"
        >
          {TIME_RANGES.map((r, i) => (
            <option key={r.label} value={i}>
              {r.label}
            </option>
          ))}
        </select>

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
            size="icon-xs"
            onClick={() => setAutoRefresh((v) => !v)}
            className={
              autoRefresh
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "text-zinc-500 hover:text-zinc-300"
            }
            title={autoRefresh ? "Pause streaming live logs" : "Resume streaming live logs"}
          >
            {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="mx-4 mt-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
          {errors.map((err, i) => (
            <div key={i}>⚠ {err}</div>
          ))}
        </div>
      )}

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
              const borderClass = LEVEL_BORDER[entry.level] || LEVEL_BORDER.debug;
              const sourceColor = SOURCE_STYLES[entry.source] || "text-zinc-400";
              const showData = hasData(entry.data);
              const entryKey = `${entry.time}-${i}`;
              const isNew = newEntryKeys.size > 0 && Array.from(newEntryKeys).some(k => k.startsWith(entry.time));

              return (
                <div key={entryKey} className={`${borderClass} ${isNew ? "animate-fade-in bg-zinc-800/30" : ""}`}>
                  <div
                    role={showData ? "button" : undefined}
                    tabIndex={showData ? 0 : undefined}
                    onClick={showData ? () => toggleExpand(i) : undefined}
                    onKeyDown={
                      showData
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExpand(i);
                            }
                          }
                        : undefined
                    }
                    className={`px-4 py-1.5 hover:bg-zinc-800/50 flex items-start gap-2 transition-colors ${
                      showData ? "cursor-pointer" : ""
                    }`}
                  >
                    {/* Expand indicator — only if data exists */}
                    {showData ? (
                      <span className="mt-0.5 text-zinc-600 shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </span>
                    ) : (
                      <span className="shrink-0 w-3" />
                    )}

                    {/* Timestamp */}
                    <span className="text-zinc-500 shrink-0 whitespace-nowrap">
                      {formatTimestamp(entry.time)}
                    </span>

                    {/* Source */}
                    <span className={`shrink-0 text-[11px] font-medium ${sourceColor}`}>
                      {entry.source}
                    </span>

                    {/* Category */}
                    {entry.category && (
                      <span className="shrink-0 text-zinc-600 text-[11px]">
                        {entry.category}
                      </span>
                    )}

                    {/* Message — always full, no truncation, key=value highlighted */}
                    <span className="text-zinc-300 whitespace-pre-wrap break-words min-w-0">
                      {formatMessage(entry.message)}
                    </span>
                  </div>

                  {/* Expanded data JSON */}
                  {isExpanded && showData && (
                    <div className="pl-12 pr-4 pb-2">
                      <div className="relative group/json">
                        <CopyJsonButton json={entry.data!} />
                        <pre className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 overflow-x-auto text-[11px] leading-relaxed">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      </div>
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
