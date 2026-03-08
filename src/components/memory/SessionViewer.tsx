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
 * Strip internal metadata from message text:
 * - [message_id: ...], [sender_id: ...], etc.
 * - "Conversation info (untrusted metadata):" blocks with JSON
 * - "Sender (untrusted metadata):" blocks
 * - Lines that are just JSON with message_id, sender_id, sender, timestamp
 */
function stripMetadata(text: string): string {
  // Strip [key: value] patterns for known metadata keys
  let cleaned = text.replace(/\[(?:message_id|sender_id|chat_id|reply_to_message_id|forward_from):\s*[^\]]*\]/gi, "");

  // Strip "Conversation info (untrusted metadata):" block and following JSON-like content
  cleaned = cleaned.replace(
    /Conversation info \(untrusted metadata\):?\s*\n?(\{[\s\S]*?\}\s*\n?|\s*(?:(?:message_id|sender_id|sender|timestamp|chat_id)[^\n]*\n?)*)/gi,
    ""
  );

  // Strip "Sender (untrusted metadata):" blocks
  cleaned = cleaned.replace(
    /Sender \(untrusted metadata\):?\s*[^\n]*\n?/gi,
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

  // Clean up excessive blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
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
        // We show messages from startIdx = max(0, messages.length - visibleCount)
        // We need matchIdx >= startIdx, so visibleCount >= messages.length - matchIdx
        const neededVisible = messages.length - matchIdx;
        if (neededVisible > visibleCount) {
          setVisibleCount(Math.min(neededVisible + PAGE_SIZE, messages.length));
        }
        setHighlightedMsgId(messages[matchIdx].id);
        // Scroll to the highlighted message after render
        requestAnimationFrame(() => {
          const el = document.getElementById(`msg-${messages[matchIdx].id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            // Flash highlight
            el.classList.add("ring-2", "ring-yellow-500/60");
            setTimeout(() => {
              el.classList.remove("ring-2", "ring-yellow-500/60");
              setHighlightedMsgId(null);
            }, 2000);
          }
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
    // Load more when scrolling near bottom (since we now start at top)
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

  // Show first N messages (start from top now)
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
          <span className="text-[10px] text-zinc-600 font-mono ml-auto truncate max-w-[200px]" title={sessionInfo.meta.key}>
            {sessionInfo.meta.key}
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
                {isUser ? (
                  <div className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                    {displayText}
                  </div>
                ) : (
                  <Markdown className="text-sm text-zinc-200 break-words [&_pre]:bg-zinc-900 [&_code]:bg-zinc-900">
                    {displayText}
                  </Markdown>
                )}
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
