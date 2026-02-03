"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * Format date and time in ISO-style: YYYY-MM-DD HH:MM
 */
function formatDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Displays a subtle build tag in the corner of the app.
 * Format: "Build 8b94251 · 2026-02-03 14:21"
 * Time updates every minute.
 */
export function VersionTag() {
  // Get commit SHA from Vercel env (available at build time)
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";

  // Use useSyncExternalStore for time updates (avoids setState-in-effect lint error)
  const subscribe = useCallback((callback: () => void) => {
    const interval = setInterval(callback, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const getSnapshot = useCallback(() => formatDateTime(), []);
  const getServerSnapshot = useCallback(() => "", []); // Empty on server to avoid hydration mismatch
  
  const localDateTime = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Don't render on server (no hydration mismatch)
  if (!localDateTime) return null;

  return (
    <div className="fixed bottom-2 right-2 text-[10px] text-zinc-600 font-mono select-none pointer-events-none z-50">
      Build {commitSha} · {localDateTime}
    </div>
  );
}
