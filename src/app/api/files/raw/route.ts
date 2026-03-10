/**
 * Raw File Proxy Route
 *
 * Streams raw binary files from the file server with correct Content-Type.
 * Used for media playback (audio, images) in the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

export async function GET(request: NextRequest) {
  const log = new Logger({ source: "api/files/raw" });
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    log.warn("Unauthorized file access attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    log.warn("Missing path parameter");
    await log.flush();
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  log.info("GET /api/files/raw", { path: filePath });

  // Only allow media paths
  const allowedPrefixes = [
    "~/.openclaw/media/",
    "~/.clawdbot/media/",
  ];
  const isAllowed = allowedPrefixes.some((p) => filePath.startsWith(p));
  if (!isAllowed) {
    log.warn("Forbidden file path", { path: filePath });
    await log.flush();
    return NextResponse.json(
      { error: "Only media paths are allowed" },
      { status: 403 }
    );
  }

  try {
    const startTime = Date.now();
    const res = await fetch(
      `${FILE_SERVER_URL}/files/raw?path=${encodeURIComponent(filePath)}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      log.warn("File not found", { path: filePath, status: res.status });
      await log.flush();
      return NextResponse.json(
        { error: "File not found" },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = res.headers.get("Content-Length");
    const body = res.body;

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    });
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    const duration = Date.now() - startTime;
    log.info("GET /api/files/raw success", { path: filePath, contentType, duration });
    await log.flush();
    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    log.error("Failed to fetch file", { path: filePath, error: String(error) });
    await log.flush();
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  }
}
