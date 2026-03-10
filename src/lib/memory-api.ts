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
  startedAt?: string;
  agentId?: string;
  sessionFile?: string;
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

export async function getSession(id: string, agentId?: string): Promise<SessionDetail> {
  const agentParam = agentId ? `&agent=${encodeURIComponent(agentId)}` : "";
  return fetchApi<SessionDetail>(
    `/api/memory/sessions/${encodeURIComponent(id)}?_=1${agentParam}`
  );
}

/**
 * Derive session type from meta.key or other heuristics.
 * For sessions without metadata, tries to infer type from available info.
 * Handles multi-agent keys like "agent:dev:main", "agent:dev:subagent:uuid", etc.
 */
export function getSessionType(
  meta?: { key?: string; isReset?: boolean; [k: string]: unknown }
): "main" | "subagent" | "cron" | "slash" | "group" | "topic" | "unknown" {
  const key = meta?.key || "";
  // Handle both agent:main:main and agent:dev:main patterns
  if (/^agent:[^:]+:main$/.test(key)) return "main";
  if (key.includes(":topic:")) return "topic";
  if (key.includes(":telegram:group:")) return "group";
  if (key.includes(":subagent:")) return "subagent";
  if (key.includes(":cron:")) return "cron";
  if (key.includes(":slash:") || key.includes(":telegram:slash:")) return "slash";

  // If the session has no key but is a .reset file, it's likely a previous main session
  if (!key && meta?.isReset) return "main";

  return "unknown";
}

/**
 * Extract agent id from a session's meta.key.
 * Keys follow the pattern "agent:<agentId>:<type>:..."
 * Defaults to "main" if not parseable.
 */
export function getAgentId(meta?: { key?: string }): string {
  const key = meta?.key || "";
  const match = key.match(/^agent:([^:]+):/);
  return match?.[1] || "main";
}

/**
 * Format bytes to human-readable
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
