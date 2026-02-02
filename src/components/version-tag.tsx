"use client";

import { useEffect, useState } from "react";

/**
 * Displays a subtle version/time tag in the corner of the app.
 * Shows commit hash and local date/time (updates every minute).
 */
export function VersionTag() {
  const [localDateTime, setLocalDateTime] = useState<string>("");
  
  // Get commit SHA from Vercel env (available at build time)
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";

  useEffect(() => {
    // Format date and time in user's local timezone
    const formatDateTime = () => {
      const now = new Date();
      const date = now.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const time = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${date}, ${time}`;
    };

    // Set initial time
    setLocalDateTime(formatDateTime());

    // Update every minute
    const interval = setInterval(() => {
      setLocalDateTime(formatDateTime());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Don't render on server (no hydration mismatch)
  if (!localDateTime) return null;

  return (
    <div className="fixed bottom-2 right-2 text-[10px] text-zinc-600 font-mono select-none pointer-events-none z-50">
      {commitSha} · {localDateTime}
    </div>
  );
}
