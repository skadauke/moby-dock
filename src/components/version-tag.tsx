"use client";

/**
 * Format deployment time with year, month, day, and time
 * Uses the build time captured at deployment, NOT the current time
 */
function formatDeployTime(isoString: string | undefined): string {
  if (!isoString) return "";
  
  try {
    const date = new Date(isoString);
    
    // Format: "2026-02-03 14:21"
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Displays a subtle version/deploy tag in the corner of the app.
 * Shows commit hash and DEPLOYMENT time (not current time).
 */
export function VersionTag() {
  // Get commit SHA from Vercel env (available at build time)
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
  
  // Get build/deployment time (set in next.config.ts at build time)
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;
  const deployTime = formatDeployTime(buildTime);

  // Don't render if no deploy time
  if (!deployTime) return null;

  return (
    <div className="fixed bottom-2 right-2 text-[10px] text-zinc-600 font-mono select-none pointer-events-none z-50">
      {commitSha} · {deployTime}
    </div>
  );
}
