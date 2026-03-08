/**
 * Memory API client for communicating with memory search endpoints
 * Uses server-side API routes to keep tokens secure
 *
 * @module lib/memory-api
 */

export interface MemorySearchResult {
  id: number;
  path: string;
  source: "memory" | "sessions";
  start_line: number;
  end_line: number;
  snippet: string;
  rank: number;
}

export interface MemorySearchResponse {
  results: MemorySearchResult[];
  total: number;
  query: string;
}

export interface MemoryStatus {
  totalFiles: number;
  sources: { source: string; chunks: number; files: number }[];
  meta: Record<string, unknown>;
}

export interface SessionInfo {
  id: string;
  file: string;
  size: number;
  modifiedAt: string;
  meta: { key?: string; [k: string]: unknown };
}

export interface SessionMessage {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  id: string;
}

export interface SessionDetail {
  sessionId: string;
  messageCount: number;
  messages: SessionMessage[];
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(endpoint, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "Request failed");
  }
  return res.json();
}

export async function searchMemory(
  query: string,
  limit = 50
): Promise<MemorySearchResponse> {
  return fetchApi<MemorySearchResponse>(
    `/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
}

export async function getMemoryStatus(): Promise<MemoryStatus> {
  return fetchApi<MemoryStatus>("/api/memory/status");
}

export async function listSessions(): Promise<SessionInfo[]> {
  const data = await fetchApi<{ sessions: SessionInfo[] }>(
    "/api/memory/sessions"
  );
  return data.sessions;
}

export async function getSession(id: string): Promise<SessionDetail> {
  return fetchApi<SessionDetail>(
    `/api/memory/sessions/${encodeURIComponent(id)}`
  );
}

/**
 * Derive session type from meta.key
 */
export function getSessionType(
  meta?: { key?: string }
): "main" | "subagent" | "cron" | "slash" | "unknown" {
  const key = meta?.key || "";
  if (key === "agent:main:main") return "main";
  if (key.includes(":subagent:")) return "subagent";
  if (key.includes(":cron:")) return "cron";
  if (key.includes(":slash:") || key.includes(":telegram:slash:")) return "slash";
  return "unknown";
}

/**
 * Format bytes to human-readable
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
