"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExpiryStatus, TestStatus } from "@/lib/vault/types";

// ── Expiry Badge ───────────────────────────────────────────────────
const EXPIRY_STYLES: Record<ExpiryStatus, { dot: string; label: string; className: string }> = {
  ok:      { dot: "bg-green-400", label: "Valid",    className: "text-green-400 border-green-400/30" },
  warning: { dot: "bg-amber-400", label: "Expiring", className: "text-amber-400 border-amber-400/30" },
  expired: { dot: "bg-red-400",   label: "Expired",  className: "text-red-400 border-red-400/30" },
  none:    { dot: "bg-zinc-500",  label: "No expiry", className: "text-zinc-500 border-zinc-700" },
};

export function ExpiryBadge({ status }: { status: ExpiryStatus }) {
  const s = EXPIRY_STYLES[status];
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1 px-1.5 py-0", s.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </Badge>
  );
}

// ── Test Badge ─────────────────────────────────────────────────────
export function TestBadge({
  status,
  timestamp,
}: {
  status: TestStatus;
  timestamp?: string;
}) {
  if (status === "untested") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-zinc-500 border-zinc-700">
        Untested
      </Badge>
    );
  }

  const passed = status === "passed";
  const relative = timestamp ? timeAgo(timestamp) : "";

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] gap-1 px-1.5 py-0",
        passed
          ? "text-green-400 border-green-400/30"
          : "text-red-400 border-red-400/30",
      )}
    >
      {passed ? "✓ Passed" : "✗ Failed"}
      {relative && <span className="text-zinc-500 ml-0.5">{relative}</span>}
    </Badge>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
export function getExpiryStatus(expires: string | null | undefined, warningDays = 14): ExpiryStatus {
  if (!expires) return "none";
  const now = Date.now();
  const exp = new Date(expires).getTime();
  if (exp < now) return "expired";
  if (exp - now < warningDays * 86400000) return "warning";
  return "ok";
}

export function getTestStatus(result?: "pass" | "fail" | null): TestStatus {
  if (!result) return "untested";
  return result === "pass" ? "passed" : "failed";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
