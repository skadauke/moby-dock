/**
 * File List API Proxy
 *
 * Server-side proxy for directory listing operations.
 *
 * @module api/files/list
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { validateFilePath } from "@/lib/path-validation";

/** External file server URL */
const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
/** Bearer token for file server authentication (server-side only) */
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

/**
 * GET /api/files/list?dir=<dirpath>
 *
 * Lists files and directories in a given path.
 */
export async function GET(request: NextRequest) {
  const log = new Logger({ source: "api/files/list" });
  const dir = request.nextUrl.searchParams.get("dir");

  log.info("GET /api/files/list", { dir });

  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized directory list attempt", { dir });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!dir) {
    log.warn("Missing dir parameter");
    await log.flush();
    return NextResponse.json({ error: "Directory path is required" }, { status: 400 });
  }

  // Validate path against allowlist
  const pathValidation = validateFilePath(dir);
  if (!pathValidation.valid) {
    log.warn("Path validation failed on list", { dir, error: pathValidation.error });
    await log.flush();
    return NextResponse.json({ error: pathValidation.error }, { status: 403 });
  }

  try {
    const startTime = Date.now();
    const res = await fetch(`${FILE_SERVER_URL}/files/list?dir=${encodeURIComponent(dir)}`, {
      headers: {
        Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });
    const duration = Date.now() - startTime;

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      log.error("[FileServer] list failed", {
        dir,
        status: res.status,
        error: error.error,
        duration,
      });
      await log.flush();
      return NextResponse.json(
        { error: error.error || "Failed to list directory" },
        { status: res.status }
      );
    }

    const data = await res.json();
    log.info("[FileServer] list success", {
      dir,
      fileCount: data.files?.length || data.count,
      duration,
    });
    await log.flush();

    return NextResponse.json(data);
  } catch (error) {
    log.error("[FileServer] connection failed", {
      dir,
      error: error instanceof Error ? error.message : String(error),
    });
    await log.flush();
    return NextResponse.json({ error: "Failed to connect to file server" }, { status: 500 });
  }
}
