/**
 * API Route: AI Status
 * 
 * Check if AI features are configured and available.
 * GET /api/ai/status
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAiConfigured, DEFAULT_MODEL } from "@/lib/ai";

export async function GET() {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isAiConfigured();

  return NextResponse.json({
    configured,
    model: configured ? DEFAULT_MODEL : null,
    features: configured
      ? ["generate-test-script", "generate-rotation-url"]
      : [],
  });
}
