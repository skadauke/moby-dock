"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Star,
  FileText,
  ChevronDown,
  ChevronRight,
  Save,
  RefreshCw,
  RotateCcw,
  AlertCircle,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CodeEditor } from "@/components/config/CodeEditor";
import { SearchResults } from "./SearchResults";
import { SessionViewer } from "./SessionViewer";
import { readFile, writeFile } from "@/lib/file-api";
import {
  searchMemory,
  getMemoryStatus,
  listSessions,
  getSessionType,
  getAgentId,
  formatBytes,
} from "@/lib/memory-api";
import type {
  MemorySearchResult,
  MemoryStatus,
  SessionInfo,
} from "@/lib/memory-api";
import { groupByTemporalBucket } from "@/lib/temporal-bucket";
import { useAgents } from "@/lib/agents-api";

const HOME = process.env.NEXT_PUBLIC_HOME_DIR?.trim();

// ── Types ───────────────────────────────────────────────────────────
type ViewMode =
  | { kind: "empty" }
  | { kind: "file"; path: string; fullPath: string; searchQuery?: string }
  | { kind: "session"; id: string; info?: SessionInfo; highlightText?: string }
  | { kind: "search"; query: string; results: MemorySearchResult[]; total: number };

interface MemoryFileEntry {
  name: string;
  path: string;
  fullPath: string;
  date?: Date;
}

// ── Helpers ─────────────────────────────────────────────────────────
function parseDate(filename: string): Date | undefined {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return new Date(m[1] + "T12:00:00");
  return undefined;
}

function formatSessionDate(s: SessionInfo): string {
  const dateStr = s.startedAt || s.modifiedAt;
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const includeYear = d.getFullYear() !== now.getFullYear();
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" } : {}),
    });
  } catch {
    return "";
  }
}

// ── Component ───────────────────────────────────────────────────────
export function MemoryClient() {
  // Agent discovery
  const { agents } = useAgents();

  // Sidebar state
  const [searchQuery, setSearchQuery] = useState("");
  const [memoryFiles, setMemoryFiles] = useState<Record<string, MemoryFileEntry[]>>({});
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [agentSectionsOpen, setAgentSectionsOpen] = useState<Record<string, boolean>>({});
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [status, setStatus] = useState<MemoryStatus | null>(null);

  // Main area state
  const [view, setView] = useState<ViewMode>({ kind: "empty" });
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasChanges = content !== originalContent;

  // ── Load sidebar data ─────────────────────────────────────────────
  useEffect(() => {
    // Load memory files per agent
    if (agents.length > 0) {
      const filesPerAgent: Record<string, MemoryFileEntry[]> = {};
      const defaultOpen: Record<string, boolean> = {};
      Promise.all(
        agents.map(async (agent) => {
          try {
            const r = await fetch(
              `/api/files/list?dir=${encodeURIComponent(`${agent.workspace}/memory`)}`
            );
            const data = await r.json();
            const files: MemoryFileEntry[] = (data.files || [])
              .filter(
                (f: { name: string; isDirectory: boolean }) =>
                  !f.isDirectory && f.name.endsWith(".md")
              )
              .map((f: { name: string; path: string }) => ({
                name: f.name,
                path: `${agent.workspace}/memory/${f.name}`,
                fullPath: f.path,
                date: parseDate(f.name),
              }))
              .sort(
                (a: MemoryFileEntry, b: MemoryFileEntry) =>
                  (b.date?.getTime() || 0) - (a.date?.getTime() || 0)
              );
            filesPerAgent[agent.id] = files;
            defaultOpen[agent.id] = agent.isDefault;
          } catch {
            filesPerAgent[agent.id] = [];
            defaultOpen[agent.id] = agent.isDefault;
          }
        })
      ).then(() => {
        setMemoryFiles(filesPerAgent);
        setAgentSectionsOpen((prev) => {
          // Only set defaults if no sections have been toggled yet
          if (Object.keys(prev).length === 0) return defaultOpen;
          return prev;
        });
      });
    } else {
      // Fallback: no agents discovered yet, load from default path
      fetch(`/api/files/list?dir=${encodeURIComponent(`${HOME}/clawd/memory`)}`)
        .then((r) => r.json())
        .then((data) => {
          const files: MemoryFileEntry[] = (data.files || [])
            .filter(
              (f: { name: string; isDirectory: boolean }) =>
                !f.isDirectory && f.name.endsWith(".md")
            )
            .map((f: { name: string; path: string }) => ({
              name: f.name,
              path: `memory/${f.name}`,
              fullPath: f.path,
              date: parseDate(f.name),
            }))
            .sort(
              (a: MemoryFileEntry, b: MemoryFileEntry) =>
                (b.date?.getTime() || 0) - (a.date?.getTime() || 0)
            );
          setMemoryFiles({ main: files });
        })
        .catch(() => {});
    }

    // Load sessions (sort by last activity so today's active sessions group together)
    listSessions()
      .then((s) =>
        setSessions(
          [...s].sort(
            (a, b) =>
              new Date(b.modifiedAt || b.startedAt || 0).getTime() -
              new Date(a.modifiedAt || a.startedAt || 0).getTime()
          )
        )
      )
      .catch(() => {});

    // Load status
    getMemoryStatus().then(setStatus).catch(() => {});
  }, [agents]);

  // ── File operations ───────────────────────────────────────────────
  const loadFile = useCallback(
    async (path: string, fullPath: string) => {
      if (hasChanges && !confirm("You have unsaved changes. Discard them?"))
        return;

      setIsLoading(true);
      setError(null);
      try {
        const data = await readFile(fullPath);
        setContent(data.content);
        setOriginalContent(data.content);
        setView({ kind: "file", path, fullPath });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load file"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [hasChanges]
  );

  const saveFile = useCallback(async () => {
    if (view.kind !== "file" || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      await writeFile(view.fullPath, content);
      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [view, content, hasChanges]);

  const reloadFile = useCallback(async () => {
    if (view.kind !== "file") return;
    if (hasChanges && !confirm("Discard unsaved changes and reload?")) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await readFile(view.fullPath);
      setContent(data.content);
      setOriginalContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload");
    } finally {
      setIsLoading(false);
    }
  }, [view, hasChanges]);

  // ── Search ────────────────────────────────────────────────────────
  const doSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setError(null);
    try {
      const data = await searchMemory(q);
      setView({
        kind: "search",
        query: q,
        results: data.results,
        total: data.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // ── Navigate from search results ──────────────────────────────────
  const handleSearchSelectFile = useCallback(
    (path: string, query?: string) => {
      // path from search is like "MEMORY.md" or "memory/2026-03-08.md"
      const fullPath = `${HOME}/clawd/${path}`;
      loadFile(path, fullPath).then(() => {
        if (query) {
          setView((prev) =>
            prev.kind === "file" ? { ...prev, searchQuery: query } : prev
          );
        }
      });
    },
    [loadFile]
  );

  const handleSearchSelectSession = useCallback(
    (id: string, query?: string) => {
      const info = sessions.find((s) => s.id === id);
      setView({ kind: "session", id, info, highlightText: query });
    },
    [sessions]
  );

  // ── Select session from sidebar ───────────────────────────────────
  const handleSelectSession = useCallback(
    (s: SessionInfo) => {
      if (hasChanges && !confirm("You have unsaved changes. Discard them?"))
        return;
      setView({ kind: "session", id: s.id, info: s });
    },
    [hasChanges]
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (view.kind === "file" && hasChanges) saveFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        e.stopPropagation();
        if (view.kind === "file") reloadFile();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [saveFile, reloadFile, view, hasChanges]);

  // ── Filename for display ──────────────────────────────────────────
  const displayName =
    view.kind === "file"
      ? view.path.split("/").pop() || view.path
      : "";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">
      {/* ─── Sidebar ─── */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950 flex-shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
              placeholder="Search memory…"
              className="pl-8 h-8 text-sm bg-zinc-900 border-zinc-700 focus:border-zinc-500"
            />
            {isSearching && (
              <RefreshCw className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 animate-spin" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Memory Files */}
          <div className="p-2">
            <button
              onClick={() => setMemoryOpen(!memoryOpen)}
              className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400"
            >
              {memoryOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Memory Files
            </button>
            {memoryOpen && (
              <div className="space-y-0.5 mt-1">
                {agents.length > 0 ? (
                  agents.map((agent) => {
                    const agentFiles = memoryFiles[agent.id] || [];
                    const isOpen = agentSectionsOpen[agent.id] ?? agent.isDefault;
                    const memoryMdPath = `${agent.workspace}/MEMORY.md`;

                    return (
                      <div key={agent.id}>
                        {/* Agent section header */}
                        <button
                          onClick={() =>
                            setAgentSectionsOpen((prev) => ({
                              ...prev,
                              [agent.id]: !isOpen,
                            }))
                          }
                          className="flex items-center gap-1 w-full px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-400"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <span>{agent.emoji || "📁"} {agent.name}</span>
                        </button>

                        {isOpen && (
                          <div className="space-y-0.5 ml-1">
                            {/* Pinned MEMORY.md */}
                            <button
                              onClick={() =>
                                loadFile(memoryMdPath, memoryMdPath)
                              }
                              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors ${
                                view.kind === "file" && view.fullPath === memoryMdPath
                                  ? "bg-zinc-800 text-zinc-200"
                                  : "text-zinc-400"
                              }`}
                            >
                              <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                              <span className="truncate">MEMORY.md</span>
                            </button>

                            {/* Daily files grouped by date */}
                            {agentFiles.length === 0 ? (
                              <p className="text-xs text-zinc-600 px-2 py-1">
                                No daily notes found
                              </p>
                            ) : (
                              groupByTemporalBucket(agentFiles, (f) => f.date).map(
                                ({ bucket, items }, idx) => (
                                  <div key={`${bucket}-${idx}`}>
                                    <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                                      {bucket}
                                    </div>
                                    {items.map((f) => (
                                      <button
                                        key={f.fullPath}
                                        onClick={() => loadFile(f.path, f.fullPath)}
                                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors ${
                                          view.kind === "file" && view.fullPath === f.fullPath
                                            ? "bg-zinc-800 text-zinc-200"
                                            : "text-zinc-400"
                                        }`}
                                      >
                                        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="truncate">{f.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <>
                    {/* Fallback: single agent view */}
                    <button
                      onClick={() =>
                        loadFile("MEMORY.md", `${HOME}/clawd/MEMORY.md`)
                      }
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors ${
                        view.kind === "file" && view.path === "MEMORY.md"
                          ? "bg-zinc-800 text-zinc-200"
                          : "text-zinc-400"
                      }`}
                    >
                      <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="truncate">MEMORY.md</span>
                    </button>

                    {(memoryFiles["main"] || []).length === 0 ? (
                      <p className="text-xs text-zinc-600 px-2 py-1">
                        No daily notes found
                      </p>
                    ) : (
                      groupByTemporalBucket(memoryFiles["main"] || [], (f) => f.date).map(
                        ({ bucket, items }, idx) => (
                          <div key={`${bucket}-${idx}`}>
                            <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                              {bucket}
                            </div>
                            {items.map((f) => (
                              <button
                                key={f.name}
                                onClick={() => loadFile(f.path, f.fullPath)}
                                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors ${
                                  view.kind === "file" && view.path === f.path
                                    ? "bg-zinc-800 text-zinc-200"
                                    : "text-zinc-400"
                                }`}
                              >
                                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </button>
                            ))}
                          </div>
                        )
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="p-2 pt-0">
            <button
              onClick={() => setSessionsOpen(!sessionsOpen)}
              className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400"
            >
              {sessionsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Sessions
              <span className="text-zinc-600 ml-1 normal-case font-normal">
                ({sessions.length})
              </span>
            </button>
            {sessionsOpen && (
              <div className="space-y-0.5 mt-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-zinc-600 px-2 py-1">
                    No sessions found
                  </p>
                ) : (
                  groupByTemporalBucket(
                    sessions,
                    (s) => {
                      const dateStr = s.modifiedAt || s.startedAt;
                      if (!dateStr) return undefined;
                      try {
                        const d = new Date(dateStr);
                        return isNaN(d.getTime()) ? undefined : d;
                      } catch { return undefined; }
                    }
                  ).map(({ bucket, items }, idx) => (
                    <div key={`${bucket}-${idx}`}>
                      <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                        {bucket}
                      </div>
                      {items.map((s) => {
                        const st = getSessionType(s.meta, s.file);
                        const isMain = st === "main";
                        const sessionAgentId = s.agentId || getAgentId(s.meta);
                        const sessionAgent = agents.find((a) => a.id === sessionAgentId);
                        const agentEmoji = sessionAgent?.emoji;
                        const typeLabel =
                          st === "main"
                            ? "Main"
                            : st === "subagent"
                              ? "Sub"
                              : st === "cron"
                                ? "Cron"
                                : st === "slash"
                                  ? "Slash"
                                  : st === "group"
                                    ? "Group"
                                    : st === "topic"
                                      ? "Topic"
                                      : null;
                        const typeBadgeClass =
                          st === "main"
                            ? "border-blue-800 text-blue-400"
                            : st === "subagent"
                              ? "border-purple-800 text-purple-500"
                              : st === "cron"
                                ? "border-amber-800 text-amber-500"
                                : st === "slash"
                                  ? "border-green-800 text-green-500"
                                  : st === "group" || st === "topic"
                                    ? "border-teal-800 text-teal-400"
                                    : "border-zinc-700 text-zinc-500";

                        return (
                          <button
                            key={s.id}
                            onClick={() => handleSelectSession(s)}
                            title={s.meta?.key || s.id}
                            className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-sm hover:bg-zinc-800 transition-colors ${
                              view.kind === "session" && view.id === s.id
                                ? "bg-zinc-800 text-zinc-200"
                                : isMain
                                  ? "text-zinc-400"
                                  : "text-zinc-600"
                            }`}
                          >
                            {agentEmoji && (
                              <span className="text-xs flex-shrink-0" title={sessionAgent?.name}>
                                {agentEmoji}
                              </span>
                            )}
                            <span className="truncate text-xs">
                              {formatSessionDate(s)}
                            </span>
                            {typeLabel && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 h-4 ${typeBadgeClass}`}
                              >
                                {typeLabel}
                              </Badge>
                            )}
                            <span className="ml-auto text-[10px] text-zinc-600 flex-shrink-0">
                              {formatBytes(s.size)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar (file mode only) */}
        {view.kind === "file" && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-zinc-400 truncate">
                {view.path}
              </span>
              {hasChanges && (
                <span className="text-xs text-amber-500 flex-shrink-0">
                  (unsaved)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-green-500">Saved!</span>
              )}
              {error && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={reloadFile}
                disabled={isLoading}
                className="h-8"
                title="Reload (⌘R)"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="ml-1">Reload</span>
                <span className="ml-1 text-xs text-zinc-500">⌘R</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={saveFile}
                disabled={!hasChanges || isSaving}
                className="h-8"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-1">Save</span>
                <span className="ml-1 text-xs text-zinc-500">⌘S</span>
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-6 w-6 text-zinc-500 animate-spin" />
            </div>
          ) : view.kind === "file" ? (
            <CodeEditor
              value={content}
              filename={displayName}
              onChange={setContent}
              onSave={saveFile}
              searchQuery={view.searchQuery}
            />
          ) : view.kind === "session" ? (
            <SessionViewer sessionId={view.id} sessionInfo={view.info} highlightText={view.highlightText} />
          ) : view.kind === "search" ? (
            <SearchResults
              query={view.query}
              results={view.results}
              total={view.total}
              onSelectFile={handleSearchSelectFile}
              onSelectSession={handleSearchSelectSession}
            />
          ) : (
            /* Empty state / dashboard */
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
              <Database className="h-16 w-16 text-zinc-600" />
              <h2 className="text-xl font-semibold text-zinc-300">
                Memory Browser
              </h2>
              {status ? (
                <div className="text-sm space-y-1 text-center">
                  <p>
                    <span className="text-zinc-300 font-medium">
                      {status.totalFiles}
                    </span>{" "}
                    files indexed
                  </p>
                  {status.sources.map((s) => (
                    <p key={s.source} className="text-xs text-zinc-600">
                      {s.source}: {s.files} files, {s.chunks} chunks
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm">Loading index stats…</p>
              )}
              <p className="text-xs text-zinc-600 max-w-sm text-center">
                Search across memory files and session transcripts, or browse
                daily notes and conversations in the sidebar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
