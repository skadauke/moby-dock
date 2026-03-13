"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { getSession, getSessionType, getAgentId } from "@/lib/memory-api";
import { useAgents } from "@/lib/agents-api";
import type { SessionMessage, SessionInfo } from "@/lib/memory-api";

interface SessionViewerProps {
  sessionId: string;
  sessionInfo?: SessionInfo;
  highlightText?: string;
}

/** How many messages to show per page */
const PAGE_SIZE = 100;

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatSessionDate(info?: SessionInfo): string {
  const dateStr = info?.startedAt || info?.modifiedAt;
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// ── Channel detection ───────────────────────────────────────────────

interface ChannelInfo {
  channel: string;
  color: string;
}

function detectChannel(text: string): ChannelInfo | null {
  if (/^\[Telegram\s/i.test(text)) return { channel: "Telegram", color: "border-blue-700 text-blue-400 bg-blue-500/10" };
  if (/^Read HEARTBEAT/i.test(text)) return { channel: "System", color: "border-zinc-600 text-zinc-400 bg-zinc-500/10" };
  if (/^\[Inter-session message\]/i.test(text)) return { channel: "Internal", color: "border-purple-700 text-purple-400 bg-purple-500/10" };
  if (/^\[Queued messages/i.test(text)) return { channel: "Queued", color: "border-amber-700 text-amber-400 bg-amber-500/10" };
  if (/^System(\s*\(untrusted\))?:/i.test(text)) return { channel: "System", color: "border-zinc-600 text-zinc-400 bg-zinc-500/10" };
  // Default for conversation info blocks with no explicit channel
  if (/^Conversation info \(untrusted metadata\)/i.test(text)) return { channel: "Telegram", color: "border-blue-700 text-blue-400 bg-blue-500/10" };
  return null;
}

// ── Media extraction ────────────────────────────────────────────────

interface MediaInfo {
  path: string;
  mimeType: string;
  type: "audio" | "image" | "video" | "other";
}

function extractMedia(text: string): { cleaned: string; media: MediaInfo[] } {
  const media: MediaInfo[] = [];
  const cleaned = text.replace(
    /\[media attached:\s*([^\]]*?)\s*\(([^)]+)\)\s*(?:\|[^\]]*?)?\]\s*/gi,
    (_match, filePath: string, mimeType: string) => {
      const fp = filePath.trim();
      const mt = mimeType.trim().split(";")[0].trim(); // strip codec info
      let type: MediaInfo["type"] = "other";
      if (mt.startsWith("audio/")) type = "audio";
      else if (mt.startsWith("image/")) type = "image";
      else if (mt.startsWith("video/")) type = "video";
      media.push({ path: fp, mimeType: mt, type });
      return "";
    }
  );
  // Also handle "N files" pattern
  const cleaned2 = cleaned.replace(/\[media attached:\s*\d+\s*files?\]\s*/gi, "");
  return { cleaned: cleaned2, media };
}

function getMediaUrl(filePath: string): string {
  // Convert absolute path to ~/ relative
  const HOME = process.env.NEXT_PUBLIC_HOME_DIR?.trim();
  let relativePath = filePath;
  if (HOME && filePath.startsWith(HOME)) {
    relativePath = "~" + filePath.slice(HOME.length);
  }
  return `/api/files/raw?path=${encodeURIComponent(relativePath)}`;
}

// ── Telegram reply extraction ───────────────────────────────────────

interface ReplyContext {
  senderLabel: string;
  body: string;
}

function extractReplyContext(text: string): { reply: ReplyContext | null; cleaned: string } {
  const replyMatch = text.match(
    /Replied message \(untrusted, for context\):\s*\n```json\n([\s\S]*?)\n```/i
  );
  if (!replyMatch) {
    // Try without fenced JSON
    const altMatch = text.match(
      /Replied message \(untrusted, for context\):\s*\n?\{([\s\S]*?)\}/i
    );
    if (!altMatch) return { reply: null, cleaned: text };
    try {
      const json = JSON.parse("{" + altMatch[1] + "}");
      const cleaned = text.replace(altMatch[0], "").trim();
      return {
        reply: {
          senderLabel: json.sender_label || "Unknown",
          body: (json.body || "").slice(0, 200),
        },
        cleaned,
      };
    } catch {
      return { reply: null, cleaned: text };
    }
  }
  try {
    const json = JSON.parse(replyMatch[1]);
    const cleaned = text.replace(replyMatch[0], "").trim();
    return {
      reply: {
        senderLabel: json.sender_label || "Unknown",
        body: (json.body || "").slice(0, 200),
      },
      cleaned,
    };
  } catch {
    return { reply: null, cleaned: text };
  }
}

// ── Subagent completion detection ───────────────────────────────────

interface SubagentCompletion {
  taskName: string;
  status: string;
  result: string;
  stats?: string;
}

function detectSubagentCompletion(text: string): SubagentCompletion | null {
  if (!/\[Internal task completion event\]/i.test(text)) return null;

  const taskMatch = text.match(/task:\s*(.+)/im);
  const statusMatch = text.match(/status:\s*(.+)/im);
  const resultMatch = text.match(
    /<<<BEGIN_UNTRUSTED_CHILD_RESULT>>>([\s\S]*?)<<<END_UNTRUSTED_CHILD_RESULT>>>/
  );
  const statsMatch = text.match(/Stats:\s*(.+)/im);

  return {
    taskName: taskMatch?.[1]?.trim() || "Unknown task",
    status: statusMatch?.[1]?.trim() || "completed",
    result: resultMatch?.[1]?.trim() || "",
    stats: statsMatch?.[1]?.trim(),
  };
}

// ── Strip metadata ──────────────────────────────────────────────────

/**
 * Strip internal metadata from message text.
 * Removes conversation info blocks, sender blocks, telegram headers,
 * system exec output, cron tags, media metadata, runtime context, and MEDIA directives.
 */
function stripMetadata(text: string): string {
  let cleaned = text;

  // Pattern A — Conversation info blocks with fenced JSON
  cleaned = cleaned.replace(
    /Conversation info \(untrusted metadata\):?\s*\n```json\n[\s\S]*?\n```\s*/gi,
    ""
  );
  // Pattern A fallback — without fenced JSON (inline or bare JSON)
  cleaned = cleaned.replace(
    /Conversation info \(untrusted metadata\):?\s*\n?\{[\s\S]*?\}\s*/gi,
    ""
  );

  // Pattern B — Sender blocks with fenced JSON
  cleaned = cleaned.replace(
    /Sender \(untrusted metadata\):?\s*\n```json\n[\s\S]*?\n```\s*/gi,
    ""
  );
  // Pattern B fallback — without fence
  cleaned = cleaned.replace(
    /Sender \(untrusted metadata\):?\s*\n?\{[\s\S]*?\}\s*/gi,
    ""
  );

  // Pattern C — Telegram envelope headers
  cleaned = cleaned.replace(
    /\[Telegram\s+[^\]]*?id:\d+[^\]]*?\]\s*/gi,
    ""
  );

  // Pattern D — System exec output
  cleaned = cleaned.replace(
    /^System \(untrusted\):.*$/gm,
    ""
  );

  // Pattern E — Cron tags
  cleaned = cleaned.replace(
    /\[cron:[0-9a-f-]+\s+[^\]]*?\]\s*/gi,
    ""
  );

  // Pattern F — Media attachment metadata (now handled by extractMedia, but still clean up)
  cleaned = cleaned.replace(
    /\[media attached:\s*[^\]]*?\]\s*/gi,
    ""
  );

  // Pattern G — OpenClaw runtime context blocks (multi-line)
  cleaned = cleaned.replace(
    /\[[^\]]*?\]\s*OpenClaw runtime context \(internal\):[\s\S]*?(?=\n\n|\n[^\s]|$)/gi,
    ""
  );

  // Pattern H — MEDIA: directives
  cleaned = cleaned.replace(
    /To send an image back, prefer the message tool[^\n]*(?:\n[^\n]*MEDIA:[^\n]*)?/gi,
    ""
  );
  cleaned = cleaned.replace(
    /^MEDIA:[^\n]*$/gm,
    ""
  );

  // Strip [key: value] patterns for known metadata keys
  cleaned = cleaned.replace(
    /\[(?:message_id|sender_id|chat_id|reply_to_message_id|forward_from):\s*[^\]]*\]/gi,
    ""
  );

  // Strip standalone JSON blocks that contain metadata fields
  cleaned = cleaned.replace(
    /^\s*\{[^}]*(?:"message_id"|"sender_id"|"sender"|"timestamp")[^}]*\}\s*$/gm,
    ""
  );

  // Strip lines that are just metadata key-value pairs
  cleaned = cleaned.replace(
    /^\s*(?:message_id|sender_id|sender|timestamp|chat_id|reply_to_message_id):\s*.*$/gm,
    ""
  );

  // Strip Replied message blocks (handled separately by extractReplyContext)
  cleaned = cleaned.replace(
    /Replied message \(untrusted, for context\):\s*\n```json\n[\s\S]*?\n```\s*/gi,
    ""
  );
  cleaned = cleaned.replace(
    /Replied message \(untrusted, for context\):\s*\n?\{[\s\S]*?\}\s*/gi,
    ""
  );

  // Clean up excessive blank lines left behind and trim
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

/**
 * Detect if a "user" message is actually a subagent or cron system message
 * that should be displayed differently.
 */
function detectSystemUserMessage(text: string): { isSystem: boolean; badge?: string; summary?: string } {
  // Subagent completion events (that don't have full result content)
  if (
    (/^\[Internal task completion event\]/i.test(text) || /source:\s*subagent/i.test(text)) &&
    !text.includes("<<<BEGIN_UNTRUSTED_CHILD_RESULT>>>")
  ) {
    const taskMatch = text.match(/task[:\s]+["']?([^"'\n]+)/i);
    const statusMatch = text.match(/status[:\s]+["']?(\w+)/i);
    return {
      isSystem: true,
      badge: "Subagent",
      summary: taskMatch
        ? `${taskMatch[1]}${statusMatch ? ` — ${statusMatch[1]}` : ""}`
        : "Subagent task completed",
    };
  }

  // sourceSession=agent:main:subagent: or sourceTool=subagent_announce
  if (/sourceSession=agent:main:subagent:/i.test(text) || /sourceTool=subagent_announce/i.test(text)) {
    return {
      isSystem: true,
      badge: "Subagent",
      summary: "Subagent announcement",
    };
  }

  // Cron system messages
  if (/^System:\s*\[\d{4}-\d{2}-\d{2}\s/i.test(text)) {
    const taskMatch = text.match(/\]\s*(.+)/);
    return {
      isSystem: true,
      badge: "Cron",
      summary: taskMatch ? taskMatch[1].slice(0, 100) : "Scheduled task",
    };
  }

  return { isSystem: false };
}

/**
 * Detect if a message is a pre-compaction memory flush
 */
function isCompactionFlush(text: string): boolean {
  return /^Pre-compaction memory flush/i.test(text.trim());
}

// ── Component ───────────────────────────────────────────────────────

export function SessionViewer({ sessionId, sessionInfo, highlightText }: SessionViewerProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState(highlightText || "");
  const [searchActive, setSearchActive] = useState(!!highlightText);
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { agents } = useAgents();
  const agentId = sessionInfo?.agentId ?? getAgentId(sessionInfo?.meta);
  const agent = agents.find((a) => a.id === agentId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      setVisibleCount(PAGE_SIZE);
      try {
        const data = await getSession(sessionId, agentId);
        if (cancelled) return;
        setMessages(data.messages);
        setTotalCount(data.messageCount);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, agentId]);

  // Reset search when highlightText changes
  useEffect(() => {
    if (highlightText) {
      setSearchQuery(highlightText);
      setSearchActive(true);
    }
  }, [highlightText]);

  // Compute matches whenever searchQuery or messages change
  useEffect(() => {
    if (!searchActive || !searchQuery.trim()) {
      setMatchIndices([]);
      setCurrentMatchIdx(0);
      return;
    }
    const lowerQuery = searchQuery.toLowerCase();
    const indices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      const cleaned = stripMetadata(messages[i].text);
      if (cleaned.toLowerCase().includes(lowerQuery)) {
        indices.push(i);
      }
    }
    setMatchIndices(indices);
    setCurrentMatchIdx(0);
  }, [searchQuery, searchActive, messages]);

  // Scroll to current match
  useEffect(() => {
    if (matchIndices.length === 0 || isLoading) return;
    const msgIdx = matchIndices[currentMatchIdx];
    if (msgIdx === undefined) return;

    // Ensure visible
    if (msgIdx >= visibleCount) {
      setVisibleCount(Math.min(msgIdx + PAGE_SIZE, messages.length));
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`msg-${messages[msgIdx].id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }, [currentMatchIdx, matchIndices, isLoading, visibleCount, messages]);

  // Scroll to top on initial load (when no search)
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    if (!searchActive && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isLoading, messages, searchActive]);

  // Keyboard shortcut: Cmd+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        // Only capture if our container is focused or is an ancestor
        if (containerRef.current?.contains(document.activeElement) || containerRef.current === document.activeElement) {
          e.preventDefault();
          setSearchActive(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
      }
      if (e.key === "Escape" && searchActive) {
        setSearchActive(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchActive]);

  const navigateMatch = useCallback(
    (dir: 1 | -1) => {
      if (matchIndices.length === 0) return;
      setCurrentMatchIdx((prev) => {
        const next = prev + dir;
        if (next < 0) return matchIndices.length - 1;
        if (next >= matchIndices.length) return 0;
        return next;
      });
    },
    [matchIndices]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (
      el.scrollTop + el.clientHeight > el.scrollHeight - 200 &&
      visibleCount < messages.length
    ) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, messages.length));
    }
  }, [visibleCount, messages.length]);

  const sessionType = getSessionType(sessionInfo?.meta, sessionInfo?.file);
  const typeLabel =
    sessionType === "main"
      ? "Main"
      : sessionType === "subagent"
        ? "Subagent"
        : sessionType === "cron"
          ? "Cron"
          : sessionType === "slash"
            ? "Slash"
            : sessionType === "group"
              ? "Group"
              : sessionType === "topic"
                ? "Topic"
                : null; // No badge for unknown
  const typeBadgeClass =
    sessionType === "main"
      ? "border-blue-700 text-blue-400"
      : sessionType === "subagent"
        ? "border-purple-700 text-purple-400"
        : sessionType === "cron"
          ? "border-amber-700 text-amber-400"
          : sessionType === "slash"
            ? "border-green-700 text-green-400"
            : sessionType === "group" || sessionType === "topic"
              ? "border-teal-700 text-teal-400"
              : "border-zinc-700 text-zinc-400";

  const topicNumber = (sessionInfo?.meta?.key as string)?.match(/:topic:(\d+)/)?.[1] || null;

  // Build set of matching message IDs for highlight
  const matchMsgIds = new Set(matchIndices.map((i) => messages[i]?.id));
  const currentMatchMsgId = matchIndices.length > 0 ? messages[matchIndices[currentMatchIdx]]?.id : null;

  // Show first N messages (start from top)
  const visibleMessages = messages.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-6 w-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full" tabIndex={-1}>
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 flex-wrap" title={sessionInfo?.meta?.key as string || ""}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {agent?.emoji && (
            <span
              className="text-base"
              title={agent.name}
              role="img"
              aria-label={agent.name}
            >
              {agent.emoji}
            </span>
          )}
          {typeLabel && (
            <Badge variant="outline" className={`text-[10px] ${typeBadgeClass}`}>
              {typeLabel}
            </Badge>
          )}
          {sessionInfo?.meta?.subject ? (
            <span className="text-sm text-zinc-300">
              {String(sessionInfo.meta.subject)}
              {topicNumber && (
                <span className="text-zinc-500"> &gt; Topic {topicNumber}</span>
              )}
            </span>
          ) : null}
          <span className={`text-sm ${sessionInfo?.meta?.subject ? "text-zinc-500" : "text-zinc-300"}`}>
            {sessionInfo?.meta?.subject ? "·" : ""} {formatSessionDate(sessionInfo)}
          </span>
          <span className="text-xs text-zinc-500">
            {totalCount} message{totalCount !== 1 ? "s" : ""}
          </span>
          {sessionInfo?.meta?.key ? (
            <span className="text-[10px] text-zinc-600 font-mono ml-auto truncate max-w-[250px]" title={sessionInfo.meta.key as string}>
              {sessionInfo.meta.key as string}
            </span>
          ) : (
            <span className="text-[10px] text-zinc-600 font-mono ml-auto truncate max-w-[250px]">
              {sessionId}
            </span>
          )}
        </div>

        {/* Search bar */}
        {searchActive ? (
          <div className="flex items-center gap-1.5 w-full mt-2 sm:mt-0 sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-500" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigateMatch(e.shiftKey ? -1 : 1);
                  }
                }}
                placeholder="Search in session…"
                className="pl-7 h-7 text-xs bg-zinc-900 border-zinc-700 focus:border-zinc-500"
                autoFocus
              />
            </div>
            {matchIndices.length > 0 && (
              <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                {currentMatchIdx + 1}/{matchIndices.length}
              </span>
            )}
            {searchQuery && matchIndices.length === 0 && (
              <span className="text-[10px] text-zinc-500 whitespace-nowrap">0 matches</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => navigateMatch(-1)}
              disabled={matchIndices.length === 0}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => navigateMatch(1)}
              disabled={matchIndices.length === 0}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => {
                setSearchActive(false);
                setSearchQuery("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
            onClick={() => {
              setSearchActive(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            title="Search (⌘F)"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {visibleMessages.map((msg) => {
          const rawText = msg.text;
          const isHighlighted = matchMsgIds.has(msg.id);
          const isCurrentMatch = currentMatchMsgId === msg.id;

          // Detect channel before stripping
          const channelInfo = msg.role === "user" ? detectChannel(rawText) : null;

          // Extract reply context before stripping
          const { reply: replyContext, cleaned: afterReply } =
            msg.role === "user" ? extractReplyContext(rawText) : { reply: null, cleaned: rawText };

          // Extract media before stripping
          const { cleaned: afterMedia, media } =
            msg.role === "user" ? extractMedia(afterReply) : { cleaned: afterReply, media: [] };

          // Detect subagent completion (before stripping)
          const subagentCompletion = msg.role === "user" ? detectSubagentCompletion(afterMedia) : null;

          // Detect compaction flush
          const compactionFlush = msg.role === "user" && isCompactionFlush(afterMedia);

          const cleanText = stripMetadata(afterMedia);
          // Skip messages that are only metadata
          if (!cleanText && media.length === 0 && !subagentCompletion) return null;

          // Highlight ring classes
          const highlightRing = isCurrentMatch
            ? "ring-2 ring-yellow-400/80 rounded-lg"
            : isHighlighted
              ? "ring-1 ring-yellow-500/40 rounded-lg"
              : "";

          // ── Subagent completion bubble ──
          if (subagentCompletion) {
            const isCompleted = /complet/i.test(subagentCompletion.status);
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex justify-start pl-8 transition-all duration-300 ${highlightRing}`}>
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-purple-900/20 border border-purple-800/40">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🤖</span>
                    <span className="text-xs font-medium text-purple-300">
                      Subagent: {subagentCompletion.taskName}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 ${
                        isCompleted
                          ? "border-green-800 text-green-400"
                          : "border-red-800 text-red-400"
                      }`}
                    >
                      {isCompleted ? "completed" : "failed"}
                    </Badge>
                    {msg.timestamp && (
                      <span className="text-[10px] text-zinc-600 ml-auto">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                  {subagentCompletion.result && (
                    <div className="text-sm text-zinc-300 break-words">
                      <Markdown className="[&_pre]:bg-zinc-900 [&_code]:bg-zinc-900 [&_table]:text-xs">
                        {subagentCompletion.result.length > 2000
                          ? subagentCompletion.result.slice(0, 2000) + "\n\n…(truncated)"
                          : subagentCompletion.result}
                      </Markdown>
                    </div>
                  )}
                  {subagentCompletion.stats && (
                    <div className="mt-2 text-[10px] text-zinc-500 border-t border-purple-800/30 pt-1.5">
                      {subagentCompletion.stats}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ── Compaction flush → system message ──
          if (compactionFlush) {
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex justify-center transition-all duration-300 ${highlightRing}`}>
                <div className="max-w-lg px-3 py-1.5 rounded bg-zinc-800/50 text-zinc-500 text-xs text-center flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-zinc-700 text-zinc-400">
                    System
                  </Badge>
                  <span>Pre-compaction memory flush</span>
                  {msg.timestamp && (
                    <span className="text-zinc-600">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // Check if a "user" message is actually a subagent/cron system message
          if (msg.role === "user") {
            const systemCheck = detectSystemUserMessage(rawText);
            if (systemCheck.isSystem) {
              const badgeClass = systemCheck.badge === "Subagent"
                ? "border-purple-800 text-purple-400"
                : "border-amber-800 text-amber-400";
              return (
                <div key={msg.id} id={`msg-${msg.id}`} className={`flex justify-center transition-all duration-300 ${highlightRing}`}>
                  <div className="max-w-lg px-3 py-1.5 rounded bg-zinc-800/50 text-zinc-500 text-xs text-center flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${badgeClass}`}>
                      {systemCheck.badge}
                    </Badge>
                    <span>{systemCheck.summary}</span>
                    {msg.timestamp && (
                      <span className="text-zinc-600">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          }

          if (msg.role === "system") {
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex justify-center transition-all duration-300 ${highlightRing}`}>
                <div className="max-w-lg px-3 py-1.5 rounded bg-zinc-800/50 text-zinc-500 text-xs text-center">
                  {cleanText.length > 200
                    ? cleanText.slice(0, 200) + "…"
                    : cleanText}
                  {msg.timestamp && (
                    <span className="ml-2 text-zinc-600">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          const isUser = msg.role === "user";
          const displayText =
            cleanText.length > 2000
              ? cleanText.slice(0, 2000) + "\n\n…(truncated)"
              : cleanText;

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`flex ${isUser ? "justify-end" : "justify-start"} transition-all duration-300 ${highlightRing}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  isUser
                    ? "bg-blue-600/20 border border-blue-800/50"
                    : "bg-zinc-800/70 border border-zinc-700/50"
                }`}
              >
                <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                  <span>{isUser ? "User" : (agent?.name || "Assistant")}</span>
                  {channelInfo && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${channelInfo.color}`}
                    >
                      {channelInfo.channel}
                    </Badge>
                  )}
                  {msg.timestamp && (
                    <span className="text-zinc-600">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  )}
                </div>

                {/* Reply context */}
                {replyContext && (
                  <div className="mb-2 pl-2 border-l-2 border-zinc-600 bg-zinc-800/50 rounded-r px-2 py-1.5">
                    <span className="text-[11px] text-zinc-400">
                      ↩️ Replying to <span className="font-medium text-zinc-300">{replyContext.senderLabel}</span>:
                    </span>
                    <p className="text-[11px] text-zinc-500 mt-0.5 italic">
                      &ldquo;{replyContext.body}&rdquo;
                    </p>
                  </div>
                )}

                {/* Message text */}
                {displayText && (
                  <Markdown className="text-sm text-zinc-200 break-words [&_pre]:bg-zinc-900 [&_code]:bg-zinc-900">
                    {displayText}
                  </Markdown>
                )}

                {/* Media elements */}
                {media.map((m, i) => (
                  <div key={i} className="mt-2">
                    {m.type === "audio" && (
                      <div className="min-w-[280px]">
                        <audio controls preload="metadata" className="w-full" style={{ colorScheme: "dark" }}>
                          <source src={getMediaUrl(m.path)} type={m.mimeType} />
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )}
                    {m.type === "image" && (
                      <img
                        src={getMediaUrl(m.path)}
                        alt="Attached image"
                        className="max-w-full max-h-80 rounded border border-zinc-700"
                        loading="lazy"
                      />
                    )}
                    {m.type === "video" && (
                      <video controls preload="metadata" className="max-w-full max-h-80 rounded">
                        <source src={getMediaUrl(m.path)} type={m.mimeType} />
                      </video>
                    )}
                    {m.type === "other" && (
                      <a
                        href={getMediaUrl(m.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline"
                      >
                        📎 Download attachment
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {visibleCount < messages.length && (
          <div className="text-center text-xs text-zinc-600 py-2">
            ↓ {messages.length - visibleCount} more message
            {messages.length - visibleCount !== 1 ? "s" : ""} — scroll down to
            load
          </div>
        )}
      </div>
    </div>
  );
}
