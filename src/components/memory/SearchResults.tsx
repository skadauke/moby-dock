"use client";

import { Badge } from "@/components/ui/badge";
import type { MemorySearchResult } from "@/lib/memory-api";

interface SearchResultsProps {
  query: string;
  results: MemorySearchResult[];
  total: number;
  onSelectFile: (path: string) => void;
  onSelectSession: (id: string) => void;
}

/**
 * Sanitize snippet HTML — only allow <mark> tags
 */
function sanitizeSnippet(html: string): string {
  return html
    .replace(/<(?!\/?mark\b)[^>]*>/gi, "")
    .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;");
}

export function SearchResults({
  query,
  results,
  total,
  onSelectFile,
  onSelectSession,
}: SearchResultsProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">
          Search results for &ldquo;{query}&rdquo;
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {total} result{total !== 1 ? "s" : ""} found
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-8">
            No results found
          </p>
        )}
        {results.map((r) => {
          const isSession = r.source === "sessions";
          const sessionId = isSession
            ? r.path.replace("sessions/", "").replace(".jsonl", "")
            : null;

          return (
            <button
              key={r.id}
              className="w-full text-left p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/70 transition-colors"
              onClick={() => {
                if (isSession && sessionId) {
                  onSelectSession(sessionId);
                } else {
                  onSelectFile(r.path);
                }
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className={
                    isSession
                      ? "border-purple-700 text-purple-400 text-[10px]"
                      : "border-emerald-700 text-emerald-400 text-[10px]"
                  }
                >
                  {isSession ? "Session" : "Memory"}
                </Badge>
                <span className="text-xs text-zinc-400 truncate">
                  {r.path}
                </span>
                {r.start_line > 0 && (
                  <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">
                    L{r.start_line}–{r.end_line}
                  </span>
                )}
              </div>
              <p
                className="text-sm text-zinc-300 leading-relaxed [&_mark]:bg-yellow-500/30 [&_mark]:text-yellow-200 [&_mark]:rounded-sm [&_mark]:px-0.5"
                dangerouslySetInnerHTML={{
                  __html: sanitizeSnippet(r.snippet),
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
