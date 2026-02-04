/**
 * Gateway Restart API
 *
 * Triggers a restart of the OpenClaw gateway. This is a critical operation
 * that should be logged thoroughly for debugging and audit purposes.
 *
 * @module api/gateway/restart
 */

import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL || "http://localhost:3030";
const GATEWAY_TOKEN = process.env.CLAWDBOT_GATEWAY_TOKEN || "";
const GATEWAY_TIMEOUT_MS = 10000;

/**
 * POST /api/gateway/restart
 * Triggers a restart of the OpenClaw gateway
 */
export async function POST() {
  const log = new Logger({ source: "api/gateway/restart" });

  // Auth check - gateway restart is a critical operation
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized gateway restart attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const userId = session.user.id;
  log.info("POST /api/gateway/restart", { userId });

  try {
    const startTime = Date.now();

    const res = await fetch(`${GATEWAY_URL}/api/restart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });

    const duration = Date.now() - startTime;

    if (!res.ok) {
      const error = await res.text();
      log.error("[Gateway] restart failed", {
        userId,
        status: res.status,
        error,
        duration,
      });
      await log.flush();
      return NextResponse.json(
        { error: `Gateway restart failed: ${error}` },
        { status: res.status }
      );
    }

    log.info("[Gateway] restart initiated", {
      userId,
      duration,
      status: "success",
    });
    await log.flush();

    return NextResponse.json({
      success: true,
      message: "Gateway restart initiated",
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";

    if (isTimeout) {
      log.error("[Gateway] restart timed out", {
        userId,
        timeoutMs: GATEWAY_TIMEOUT_MS,
      });
      await log.flush();
      return NextResponse.json(
        { error: "Gateway restart timed out" },
        { status: 504 }
      );
    }

    log.error("[Gateway] connection failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to connect to gateway" },
      { status: 500 }
    );
  }
}
