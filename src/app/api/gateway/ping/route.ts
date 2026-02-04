import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

export async function POST() {
  const log = new Logger({ source: "api/gateway/ping" });
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to gateway ping");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  log.info("POST /api/gateway/ping", { userId: session.user.id });

  const startTime = Date.now();

  try {
    // Call the file server's gateway ping endpoint
    // This will forward the wake event to the OpenClaw gateway
    // Add timeout to prevent hanging requests
    const res = await fetch(`${FILE_SERVER_URL}/gateway/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FILE_SERVER_TOKEN}`,
      },
      body: JSON.stringify({
        text: "Check Ready queue for tasks",
        mode: "now",
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const duration = Date.now() - startTime;

    if (!res.ok) {
      // Log error details server-side only (don't expose to client)
      const errorText = await res.text();
      log.error("[Gateway] ping failed", {
        status: res.status,
        // Don't log full error text - may contain sensitive info
        errorLength: errorText.length,
        duration,
      });
      await log.flush();
      // Return generic error to client
      return NextResponse.json(
        { error: "Failed to ping gateway" },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Only log metadata, not full response (may contain sensitive data)
    log.info("[Gateway] ping succeeded", { 
      duration, 
      hasResponse: !!data,
      responseKeys: data ? Object.keys(data) : []
    });
    await log.flush();

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("[Gateway] ping error", {
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to connect to gateway" },
      { status: 500 }
    );
  }
}
