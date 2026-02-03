import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

const { GET: originalGet, POST: originalPost } = toNextJsHandler(auth);

// Wrap handlers to log Origin headers for Safari iOS debugging (#42)
function logAuthHeaders(request: NextRequest, method: string) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");
  const url = request.url;
  const path = new URL(url).pathname;
  
  // Log auth requests for debugging Safari iOS issues
  console.log(`[Auth ${method}] ${path}`, {
    origin,
    referer,
    userAgent: userAgent?.slice(0, 100), // Truncate UA
    isSafari: userAgent?.includes("Safari") && !userAgent?.includes("Chrome"),
    isiOS: userAgent?.includes("iPhone") || userAgent?.includes("iPad"),
  });
}

export async function GET(request: NextRequest) {
  logAuthHeaders(request, "GET");
  return originalGet(request);
}

export async function POST(request: NextRequest) {
  logAuthHeaders(request, "POST");
  return originalPost(request);
}
