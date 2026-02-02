"use client";

import { useState, useCallback } from "react";
import { Search, X, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResult {
  path: string;
  line: number;
  content: string;
}

interface SearchPanelProps {
  onSelectResult: (path: string, line?: number) => void;
}

export function SearchPanel({ onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      search(query);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  const getFileName = (path: string) => path.split("/").pop() || path;
  const getRelativePath = (path: string) => {
    const home = "/Users/skadauke";
    if (path.startsWith(home)) {
      return "~" + path.slice(home.length);
    }
    return path;
  };

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
        Search
      </h3>
      <div className="relative px-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files..."
          className="pl-8 pr-8 h-8 bg-zinc-900 border-zinc-800 text-sm"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isSearching && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Searching...
        </div>
      )}

      {error && (
        <div className="px-2 py-2 text-xs text-red-400">{error}</div>
      )}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <div className="px-2 py-2 text-xs text-zinc-500">No results found</div>
      )}

      {results.length > 0 && (
        <div className="mt-2 max-h-64 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.path}-${result.line}-${index}`}
              onClick={() => onSelectResult(result.path, result.line)}
              className={cn(
                "w-full flex flex-col gap-0.5 px-2 py-1.5 text-left rounded transition-colors",
                "text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                <span className="font-medium truncate">{getFileName(result.path)}</span>
                <span className="text-zinc-600">:{result.line}</span>
              </div>
              <div className="text-xs text-zinc-500 truncate pl-4">
                {result.content}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
