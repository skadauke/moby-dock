import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

export async function GET(request: NextRequest) {
  const log = new Logger({ source: "api/memory/search" });
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    log.warn("Unauthorized memory search attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  const limit = request.nextUrl.searchParams.get("limit") || "50";

  log.info("GET /api/memory/search", { query: q, limit });

  try {
    const startTime = Date.now();
    const res = await fetch(
      `${FILE_SERVER_URL}/memory/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) {
      const resErr = await res.json().catch(() => ({ error: res.statusText }));
      log.error("Memory search failed", { status: res.status, error: resErr.error });
      await log.flush();
      return NextResponse.json(
        { error: resErr.error || "Search failed" },
        { status: res.status }
      );
    }
    const data = await res.json();
    const duration = Date.now() - startTime;
    const resultCount = Array.isArray(data.results) ? data.results.length : 0;
    log.info("GET /api/memory/search success", { query: q, resultCount, duration });
    await log.flush();
    return NextResponse.json(data);
  } catch (error) {
    log.error("Failed to connect to file server", { error: String(error) });
    await log.flush();
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 500 }
    );
  }
}
