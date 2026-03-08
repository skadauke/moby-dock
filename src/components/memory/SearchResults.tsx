"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MemorySearchResult } from "@/lib/memory-api";

interface SearchResultsProps {
  query: string;
  results: MemorySearchResult[];
  total: number;
  onSelectFile: (path: string, query: string) => void;
  onSelectSession: (id: string, query: string) => void;
}

/**
 * Sanitize snippet HTML — only allow <mark> tags
 */
function sanitizeSnippet(html: string): string {
  return html
    .replace(/<(?!\/?mark\b)[^>]*>/gi, "")
    .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;");
}

interface FileGroup {
  path: string;
  source: "memory" | "sessions";
  results: MemorySearchResult[];
  bestRank: number;
}

function groupByFile(results: MemorySearchResult[]): FileGroup[] {
  const map = new Map<string, FileGroup>();

  for (const r of results) {
    let group = map.get(r.path);
    if (!group) {
      group = {
        path: r.path,
        source: r.source,
        results: [],
        bestRank: r.rank,
      };
      map.set(r.path, group);
    }
    group.results.push(r);
    if (r.rank < group.bestRank) {
      group.bestRank = r.rank;
    }
  }

  const groups = Array.from(map.values());
  // Sort: most matches first, then by best rank (lower = better)
  groups.sort((a, b) => {
    if (b.results.length !== a.results.length) {
      return b.results.length - a.results.length;
    }
    return a.bestRank - b.bestRank;
  });

  // Sort snippets within each group by line number
  for (const g of groups) {
    g.results.sort((a, b) => a.start_line - b.start_line);
  }

  return groups;
}

function FileGroupSection({
  group,
  query,
  onSelectFile,
  onSelectSession,
}: {
  group: FileGroup;
  query: string;
  onSelectFile: (path: string, query: string) => void;
  onSelectSession: (id: string, query: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSession = group.source === "sessions";
  const sessionId = isSession
    ? group.path.replace("sessions/", "").replace(".jsonl", "")
    : null;
  const matchCount = group.results.length;

  const navigateToFile = () => {
    if (isSession && sessionId) {
      onSelectSession(sessionId, query);
    } else {
      onSelectFile(group.path, query);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800/70 transition-colors">
        <button
          className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse group" : "Expand group"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <button
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          onClick={navigateToFile}
        >
          <Badge
            variant="outline"
            className={
              isSession
                ? "border-purple-700 text-purple-400 text-[10px] flex-shrink-0"
                : "border-emerald-700 text-emerald-400 text-[10px] flex-shrink-0"
            }
          >
            {isSession ? "Session" : "Memory"}
          </Badge>
          <span className="text-xs text-zinc-300 font-medium truncate">
            {group.path}
          </span>
        </button>
        <span className="text-[10px] text-zinc-500 flex-shrink-0 ml-auto">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Snippets */}
      {expanded && (
        <div className="border-t border-zinc-800/50">
          {group.results.map((r, idx) => {
            const isLast = idx === group.results.length - 1;
            return (
              <button
                key={r.id}
                className="w-full text-left flex gap-2 px-3 py-2 hover:bg-zinc-800/50 transition-colors group"
                onClick={() => {
                  if (isSession && sessionId) {
                    onSelectSession(sessionId, query);
                  } else {
                    onSelectFile(r.path, query);
                  }
                }}
              >
                {/* Tree connector */}
                <div className="flex-shrink-0 w-5 flex items-start justify-center pt-1">
                  <span className="text-zinc-700 text-xs font-mono">
                    {isLast ? "└─" : "├─"}
                  </span>
                </div>
                {/* Snippet content */}
                <div className="min-w-0 flex-1 border-l-2 border-zinc-800 pl-3">
                  {r.start_line > 0 && (
                    <span className="text-[10px] text-zinc-600 font-mono">
                      L{r.start_line}–{r.end_line}
                    </span>
                  )}
                  <p
                    className="text-sm text-zinc-400 leading-relaxed line-clamp-3 [&_mark]:bg-yellow-500/30 [&_mark]:text-yellow-200 [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeSnippet(r.snippet),
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SearchResults({
  query,
  results,
  total,
  onSelectFile,
  onSelectSession,
}: SearchResultsProps) {
  const groups = useMemo(() => groupByFile(results), [results]);
  const fileCount = groups.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">
          Search results for &ldquo;{query}&rdquo;
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {total} result{total !== 1 ? "s" : ""} across {fileCount} file
          {fileCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-8">
            No results found
          </p>
        )}
        {groups.map((group) => (
          <FileGroupSection
            key={group.path}
            group={group}
            query={query}
            onSelectFile={onSelectFile}
            onSelectSession={onSelectSession}
          />
        ))}
      </div>
    </div>
  );
}
