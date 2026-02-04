/**
 * API Route: Generate Rotation URL
 * 
 * Uses AI to find the rotation/management URL for a credential.
 * POST /api/ai/generate-rotation-url
 */

import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  aiAssist,
  isAiConfigured,
  RotationInfoSchema,
  rotationUrlPrompt,
  ROTATION_URL_SYSTEM_PROMPT,
} from "@/lib/ai";

interface RequestBody {
  id: string;
  type: string;
  service: string;
  notes?: string;
  account?: string;
}

export async function POST(request: Request) {
  const log = new Logger({ source: "api/ai/generate-rotation-url" });
  const startTime = Date.now();

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if AI is configured
  if (!isAiConfigured()) {
    log.error("AI not configured - missing OPENAI_API_KEY");
    await log.flush();
    return NextResponse.json(
      { error: "AI features not configured. Please set OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const body: RequestBody = await request.json();

    // Validate required fields
    if (!body.id || !body.type || !body.service) {
      return NextResponse.json(
        { error: "Missing required fields: id, type, service" },
        { status: 400 }
      );
    }

    log.info("Generating rotation URL", {
      credentialId: body.id,
      type: body.type,
      service: body.service,
      userId: session.user.id,
    });

    // Call AI to generate rotation info
    const result = await aiAssist({
      schema: RotationInfoSchema,
      prompt: rotationUrlPrompt(body),
      systemPrompt: ROTATION_URL_SYSTEM_PROMPT,
      maxValidationRetries: 2,
      timeoutMs: 30000,
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      log.error("AI generation failed", {
        credentialId: body.id,
        error: result.error,
        attempts: result.attempts,
        duration,
      });
      await log.flush();

      return NextResponse.json(
        {
          error: "Failed to generate rotation information",
          details: result.error,
          attempts: result.attempts,
        },
        { status: 500 }
      );
    }

    log.info("Rotation URL generated successfully", {
      credentialId: body.id,
      rotationUrl: result.data.rotationUrl,
      attempts: result.attempts,
      duration,
    });
    await log.flush();

    return NextResponse.json({
      success: true,
      rotationInfo: result.data,
      attempts: result.attempts,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Unexpected error generating rotation URL", {
      error: error instanceof Error ? error.message : "Unknown",
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
