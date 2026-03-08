"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSession, getSessionType } from "@/lib/memory-api";
import type { SessionMessage, SessionInfo } from "@/lib/memory-api";

interface SessionViewerProps {
  sessionId: string;
  sessionInfo?: SessionInfo;
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

export function SessionViewer({ sessionId, sessionInfo }: SessionViewerProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setVisibleCount(PAGE_SIZE);

    getSession(sessionId)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setTotalCount(data.messageCount);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isLoading]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Load more when scrolling near top
    if (el.scrollTop < 200 && visibleCount < messages.length) {
      const prevHeight = el.scrollHeight;
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, messages.length));
      // Maintain scroll position
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop;
      });
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
          : "Session";
  const typeBadgeClass =
    sessionType === "main"
      ? "border-blue-700 text-blue-400"
      : sessionType === "subagent"
        ? "border-purple-700 text-purple-400"
        : sessionType === "cron"
          ? "border-amber-700 text-amber-400"
          : "border-zinc-700 text-zinc-400";

  // Show the latest N messages (paginated from end)
  const startIdx = Math.max(0, messages.length - visibleCount);
  const visibleMessages = messages.slice(startIdx);

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
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {startIdx > 0 && (
          <div className="text-center text-xs text-zinc-600 py-2">
            ↑ {startIdx} earlier message{startIdx !== 1 ? "s" : ""} — scroll up
            to load
          </div>
        )}

        {visibleMessages.map((msg) => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-lg px-3 py-1.5 rounded bg-zinc-800/50 text-zinc-500 text-xs text-center">
                  {msg.text.length > 200
                    ? msg.text.slice(0, 200) + "…"
                    : msg.text}
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
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
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
                <div className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                  {msg.text.length > 2000
                    ? msg.text.slice(0, 2000) + "\n\n…(truncated)"
                    : msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
