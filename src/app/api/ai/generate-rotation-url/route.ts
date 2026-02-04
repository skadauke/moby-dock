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
    // Parse JSON with explicit error handling
    let body: RequestBody;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        log.warn("Invalid request body type");
        await log.flush();
        return NextResponse.json(
          { error: "Request body must be a JSON object" },
          { status: 400 }
        );
      }
      body = parsed as RequestBody;
    } catch {
      log.warn("Failed to parse JSON body");
      await log.flush();
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate required fields (log only field presence, not values)
    if (!body.id || !body.type || !body.service) {
      log.warn("Missing required fields", {
        hasId: !!body.id,
        hasType: !!body.type,
        hasService: !!body.service,
      });
      await log.flush();
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
      // Log only safe error info (not raw AI output which may contain sensitive data)
      const errorId = crypto.randomUUID().slice(0, 8);
      log.error("AI generation failed", {
        credentialId: body.id,
        errorId,
        errorType: result.error?.split(":")[0] || "unknown",
        attempts: result.attempts,
        duration,
      });
      await log.flush();

      // Return generic error message (not raw AI error which may leak prompt/data)
      return NextResponse.json(
        {
          error: "Failed to generate rotation information",
          errorId, // For debugging correlation
          attempts: result.attempts,
        },
        { status: 500 }
      );
    }

    // Log only safe data - don't log full URL as it's untrusted AI output
    let urlOrigin = "unknown";
    try {
      urlOrigin = new URL(result.data.rotationUrl).origin;
    } catch {
      // URL parsing failed - already validated by schema but defensive
    }
    log.info("Rotation URL generated successfully", {
      credentialId: body.id,
      urlOrigin, // Log only origin, not full path
      attempts: result.attempts,
      duration,
    });
    await log.flush();

    // IMPORTANT: AI output is untrusted and must be reviewed by user before use
    return NextResponse.json({
      success: true,
      rotationInfo: result.data,
      attempts: result.attempts,
      // Flag to indicate this is AI-generated and needs user confirmation
      requiresUserConfirmation: true,
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
