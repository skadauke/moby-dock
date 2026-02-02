import { NextResponse } from "next/server";

const CLAWDBOT_GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL || "http://localhost:3030";
const CLAWDBOT_GATEWAY_TOKEN = process.env.CLAWDBOT_GATEWAY_TOKEN || "";

/** Timeout for gateway restart request (in milliseconds) */
const GATEWAY_TIMEOUT_MS = 10000;

/**
 * POST /api/gateway/restart
 * Triggers a restart of the Clawdbot gateway
 */
export async function POST() {
  try {
    const res = await fetch(`${CLAWDBOT_GATEWAY_URL}/api/restart`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLAWDBOT_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: `Gateway restart failed: ${error}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, message: "Gateway restart initiated" });
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.name === "TimeoutError") {
      console.error("Gateway restart timed out");
      return NextResponse.json(
        { error: "Gateway restart timed out" },
        { status: 504 }
      );
    }
    
    console.error("Gateway restart error:", err);
    return NextResponse.json(
      { error: "Failed to connect to gateway" },
      { status: 500 }
    );
  }
}
