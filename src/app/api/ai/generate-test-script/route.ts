/**
 * API Route: Generate Test Script
 * 
 * Uses AI to generate a test script for a credential.
 * POST /api/ai/generate-test-script
 */

import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  aiAssist,
  isAiConfigured,
  TestScriptSchema,
  testScriptPrompt,
  TEST_SCRIPT_SYSTEM_PROMPT,
} from "@/lib/ai";

interface RequestBody {
  id: string;
  type: string;
  service: string;
  notes?: string;
  account?: string;
  url?: string;
}

export async function POST(request: Request) {
  const log = new Logger({ source: "api/ai/generate-test-script" });
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

    log.info("Generating test script", {
      credentialId: body.id,
      type: body.type,
      service: body.service,
      userId: session.user.id,
    });

    // Call AI to generate test script
    const result = await aiAssist({
      schema: TestScriptSchema,
      prompt: testScriptPrompt(body),
      systemPrompt: TEST_SCRIPT_SYSTEM_PROMPT,
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
          error: "Failed to generate test script",
          details: result.error,
          attempts: result.attempts,
        },
        { status: 500 }
      );
    }

    log.info("Test script generated successfully", {
      credentialId: body.id,
      attempts: result.attempts,
      duration,
    });
    await log.flush();

    // IMPORTANT: AI output is untrusted and must be reviewed by user before execution
    return NextResponse.json({
      success: true,
      testScript: result.data,
      attempts: result.attempts,
      // Flag to indicate this is AI-generated and needs user confirmation
      requiresUserConfirmation: true,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Unexpected error generating test script", {
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
