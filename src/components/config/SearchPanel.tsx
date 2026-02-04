"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, FileText, Loader2, ArrowUp, ArrowDown, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResult {
  path: string;
  line: number;
  content: string;
  fileName: string;
  matchType: "filename" | "content";
}

interface SearchPanelProps {
  onSelectResult: (path: string, line?: number) => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function SearchPanel({ onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 200);

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      setError(null);
      setIsOpen(true);

      try {
        const res = await fetch(`/api/files/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        
        // Process results - add fileName and matchType
        const processed = (data.results || []).map((r: { path: string; line: number; content: string }) => ({
          ...r,
          fileName: r.path.split("/").pop() || r.path,
          matchType: r.path.toLowerCase().includes(debouncedQuery.toLowerCase()) ? "filename" : "content",
        }));
        
        // Sort: filename matches first, then by path
        processed.sort((a: SearchResult, b: SearchResult) => {
          if (a.matchType === "filename" && b.matchType !== "filename") return -1;
          if (a.matchType !== "filename" && b.matchType === "filename") return 1;
          return a.path.localeCompare(b.path);
        });
        
        setResults(processed);
        setSelectedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelectResult(results[selectedIndex].path, results[selectedIndex].line);
          setIsOpen(false);
          setQuery("");
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, results, selectedIndex, onSelectResult]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, results.length]);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const getRelativePath = (path: string) => {
    const home = "/Users/skadauke";
    if (path.startsWith(home)) {
      return "~" + path.slice(home.length);
    }
    return path;
  };

  // Group results by file
  const groupedResults = results.reduce((acc, result) => {
    const existing = acc.find(g => g.path === result.path);
    if (existing) {
      existing.matches.push(result);
    } else {
      acc.push({ path: result.path, fileName: result.fileName, matches: [result] });
    }
    return acc;
  }, [] as { path: string; fileName: string; matches: SearchResult[] }[]);

  return (
    <div className="mb-4 relative">
      <div className="relative px-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search files... (⌘K)"
          className="pl-8 pr-8 h-9 bg-zinc-900 border-zinc-800 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 mx-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Loading state */}
          {isSearching && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-3 py-3 text-sm text-red-400">{error}</div>
          )}

          {/* No results */}
          {!isSearching && !error && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-3 text-sm text-zinc-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Results list */}
          {!isSearching && results.length > 0 && (
            <>
              <div 
                ref={resultsRef}
                className="max-h-80 overflow-y-auto overscroll-contain"
              >
                {results.map((result, index) => (
                  <button
                    key={`${result.path}-${result.line}-${index}`}
                    onClick={() => {
                      onSelectResult(result.path, result.line);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                      index === selectedIndex
                        ? "bg-blue-500/20 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">
                        <HighlightMatch text={result.fileName} query={debouncedQuery} />
                      </span>
                      <span className="text-xs text-zinc-600 flex-shrink-0">
                        :{result.line}
                      </span>
                      {result.matchType === "filename" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex-shrink-0">
                          name
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 truncate pl-6">
                      <HighlightMatch text={result.content} query={debouncedQuery} />
                    </div>
                    <div className="text-[10px] text-zinc-600 truncate pl-6">
                      {getRelativePath(result.path)}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Footer with keyboard hints */}
              <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 border-t border-zinc-700 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  <ArrowDown className="h-3 w-3" />
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="h-3 w-3" />
                  open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-zinc-700 text-zinc-400">esc</kbd>
                  close
                </span>
                <span className="ml-auto text-zinc-600">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
