"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { getSession, getSessionType } from "@/lib/memory-api";
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
  if (!info?.modifiedAt) return "";
  try {
    return new Date(info.modifiedAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

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
  // e.g. [Telegram Stephan Kadauke id:8290418965 +3m 2026-01-29 21:27 EST]
  cleaned = cleaned.replace(
    /\[Telegram\s+[^\]]*?id:\d+[^\]]*?\]\s*/gi,
    ""
  );

  // Pattern D — System exec output
  // e.g. System (untrusted): [2026-01-29 21:51:24 EST] Exec completed ...
  cleaned = cleaned.replace(
    /^System \(untrusted\):.*$/gm,
    ""
  );

  // Pattern E — Cron tags
  // e.g. [cron:f6855a4d-91b5-4e1f-8847-5e88c9f0832f supabase-keepalive]
  cleaned = cleaned.replace(
    /\[cron:[0-9a-f-]+\s+[^\]]*?\]\s*/gi,
    ""
  );

  // Pattern F — Media attachment metadata
  // Replace with emoji indicator based on type
  cleaned = cleaned.replace(
    /\[media attached:\s*[^\]]*?\(audio\/[^)]*\)[^\]]*?\]\s*/gi,
    "🎵 Audio message\n"
  );
  cleaned = cleaned.replace(
    /\[media attached:\s*[^\]]*?\(image\/[^)]*\)[^\]]*?\]\s*/gi,
    "🖼️ Image\n"
  );
  cleaned = cleaned.replace(
    /\[media attached:\s*[^\]]*?\(video\/[^)]*\)[^\]]*?\]\s*/gi,
    "🎬 Video\n"
  );
  cleaned = cleaned.replace(
    /\[media attached:\s*[^\]]*?\]\s*/gi,
    "📎 Media attachment\n"
  );

  // Pattern G — OpenClaw runtime context blocks (multi-line)
  // Starts with [date] OpenClaw runtime context (internal):
  // Continues until a blank line or end of text
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

  // Clean up excessive blank lines left behind and trim
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

/**
 * Detect if a "user" message is actually a subagent or cron system message
 * that should be displayed differently.
 */
function detectSystemUserMessage(text: string): { isSystem: boolean; badge?: string; summary?: string } {
  // Subagent completion events
  if (/^\[Internal task completion event\]/i.test(text) || /source:\s*subagent/i.test(text)) {
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

export function SessionViewer({ sessionId, sessionInfo, highlightText }: SessionViewerProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      setVisibleCount(PAGE_SIZE);
      setHighlightedMsgId(null);
      try {
        const data = await getSession(sessionId);
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
  }, [sessionId]);

  // Scroll to top by default, or scroll to highlighted message if highlightText is set
  useEffect(() => {
    if (isLoading || messages.length === 0) return;

    if (highlightText) {
      const lowerQuery = highlightText.toLowerCase();
      const matchIdx = messages.findIndex((m) =>
        stripMetadata(m.text).toLowerCase().includes(lowerQuery)
      );
      if (matchIdx >= 0) {
        // Ensure the matched message is visible by adjusting visibleCount
        const neededVisible = matchIdx + 1;
        if (neededVisible > visibleCount) {
          setVisibleCount(Math.min(neededVisible + PAGE_SIZE, messages.length));
        }
        setHighlightedMsgId(messages[matchIdx].id);
        // Scroll to the highlighted message after render — use double rAF for safety
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.getElementById(`msg-${messages[matchIdx].id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-yellow-500/60");
              setTimeout(() => {
                el.classList.remove("ring-2", "ring-yellow-500/60");
                setHighlightedMsgId(null);
              }, 2000);
            }
          });
        });
        return;
      }
    }

    // Default: scroll to top
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isLoading, messages, highlightText]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const sessionType = getSessionType(sessionInfo?.meta);
  const typeLabel =
    sessionType === "main"
      ? "Main"
      : sessionType === "subagent"
        ? "Subagent"
        : sessionType === "cron"
          ? "Cron"
          : sessionType === "slash"
            ? "Slash"
            : "Session";
  const typeBadgeClass =
    sessionType === "main"
      ? "border-blue-700 text-blue-400"
      : sessionType === "subagent"
        ? "border-purple-700 text-purple-400"
        : sessionType === "cron"
          ? "border-amber-700 text-amber-400"
          : sessionType === "slash"
            ? "border-green-700 text-green-400"
            : "border-zinc-700 text-zinc-400";

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
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
        <Badge variant="outline" className={`text-[10px] ${typeBadgeClass}`}>
          {typeLabel}
        </Badge>
        <span className="text-sm text-zinc-300">
          {formatSessionDate(sessionInfo)}
        </span>
        <span className="text-xs text-zinc-500">
          {totalCount} message{totalCount !== 1 ? "s" : ""}
        </span>
        {sessionInfo?.meta?.key && (
          <span className="text-[10px] text-zinc-600 font-mono ml-auto truncate max-w-[200px]" title={sessionInfo.meta.key as string}>
            {sessionInfo.meta.key as string}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {visibleMessages.map((msg) => {
          const cleanText = stripMetadata(msg.text);
          // Skip messages that are only metadata
          if (!cleanText) return null;

          // Check if a "user" message is actually a subagent/cron system message
          if (msg.role === "user") {
            const systemCheck = detectSystemUserMessage(msg.text);
            if (systemCheck.isSystem) {
              const badgeClass = systemCheck.badge === "Subagent"
                ? "border-purple-800 text-purple-400"
                : "border-amber-800 text-amber-400";
              return (
                <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center">
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
              <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center">
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
              className={`flex ${isUser ? "justify-end" : "justify-start"} transition-all duration-500 ${
                highlightedMsgId === msg.id ? "ring-2 ring-yellow-500/60 rounded-lg" : ""
              }`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  isUser
                    ? "bg-blue-600/20 border border-blue-800/50"
                    : "bg-zinc-800/70 border border-zinc-700/50"
                }`}
              >
                <div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
                  <span>{isUser ? "User" : "Assistant"}</span>
                  {msg.timestamp && (
                    <span className="text-zinc-600">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  )}
                </div>
                <Markdown className="text-sm text-zinc-200 break-words [&_pre]:bg-zinc-900 [&_code]:bg-zinc-900">
                  {displayText}
                </Markdown>
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
