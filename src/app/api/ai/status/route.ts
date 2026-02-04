/**
 * API Route: AI Status
 * 
 * Check if AI features are configured and available.
 * GET /api/ai/status
 */

import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAiConfigured, DEFAULT_MODEL } from "@/lib/ai";

export async function GET() {
  const log = new Logger({ source: "api/ai/status" });

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isAiConfigured();

  log.info("AI status check", { userId: session.user.id, configured });
  await log.flush();

  return NextResponse.json({
    configured,
    model: configured ? DEFAULT_MODEL : null,
    features: configured
      ? ["generate-test-script", "generate-rotation-url"]
      : [],
  });
}
