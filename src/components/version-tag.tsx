"use client";

import { useMemo } from "react";

/**
 * Format ISO date string to local YYYY-MM-DD HH:MM
 */
function formatBuildTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Displays a subtle build tag in the corner of the app.
 * Format: "Build 8b94251 · 2026-02-03 14:21"
 * Shows actual build time (from next.config.ts), not current time.
 */
export function VersionTag() {
  // Get commit SHA from Vercel env (available at build time)
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
  
  // Get build time from next.config.ts (set at build time)
  const buildTimeIso = process.env.BUILD_TIME;

  // Format build time in user's local timezone
  // useMemo to avoid hydration mismatch (compute only on client)
  const buildTime = useMemo(() => {
    if (!buildTimeIso) return null;
    return formatBuildTime(buildTimeIso);
  }, [buildTimeIso]);

  // Don't render if no build time available
  if (!buildTime) return null;

  return (
    <div className="fixed bottom-2 right-2 text-[10px] text-zinc-600 font-mono select-none pointer-events-none z-50">
      Build {commitSha} · {buildTime}
    </div>
  );
}
