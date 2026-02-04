/**
 * API Route: Generate Test Config
 * 
 * Uses AI to generate a structured test configuration for a credential.
 * POST /api/ai/generate-test-config
 */

import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  aiAssist,
  isAiConfigured,
  TestConfigSchema,
  testConfigPrompt,
  TEST_CONFIG_SYSTEM_PROMPT,
  validateTestConfigPlaceholder,
} from "@/lib/ai";
import type { SecretsFile, TestConfig } from "@/lib/vault";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";
const SECRETS_PATH = "~/.openclaw/credentials/secrets.json";

interface RequestBody {
  /** Credential ID to generate test for */
  id: string;
  /** Whether to save the generated config to the credential (default: false) */
  save?: boolean;
  /** Expected version for optimistic locking when saving */
  expectedVersion?: string;
}

export async function POST(request: Request) {
  const log = new Logger({ source: "api/ai/generate-test-config" });
  const startTime = Date.now();
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Check AI configuration
  if (!isAiConfigured()) {
    log.error("AI not configured - OPENAI_API_KEY missing");
    await log.flush();
    return NextResponse.json(
      { error: "AI not configured", message: "OPENAI_API_KEY not set" },
      { status: 503 }
    );
  }
  
  // Parse request body
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    log.warn("Invalid JSON in request body");
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  
  const { id, save = false, expectedVersion } = body;
  
  if (!id || typeof id !== 'string') {
    log.warn("Missing credential ID");
    await log.flush();
    return NextResponse.json({ error: "Missing credential ID" }, { status: 400 });
  }
  
  // Validate save is a boolean (not a truthy string like "false")
  if (save !== undefined && typeof save !== 'boolean') {
    log.warn("Invalid save parameter type", { save, type: typeof save });
    await log.flush();
    return NextResponse.json(
      { error: "Invalid save parameter", message: "save must be a boolean" },
      { status: 400 }
    );
  }
  
  // Require expectedVersion when saving
  if (save && !expectedVersion) {
    log.warn("Missing expectedVersion for save operation");
    await log.flush();
    return NextResponse.json(
      { error: "Missing expectedVersion", message: "expectedVersion required when save=true" },
      { status: 400 }
    );
  }
  
  log.info("POST /api/ai/generate-test-config", { 
    userId: session.user.id, 
    credentialId: id,
    save 
  });
  
  try {
    // Fetch secrets file (with timeout)
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    
    if (!res.ok) {
      log.error("[FileServer] read secrets failed", { status: res.status });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to read secrets" },
        { status: res.status }
      );
    }
    
    const { content } = await res.json();
    const secrets: SecretsFile = JSON.parse(content);
    
    // Find credential
    const credential = secrets.credentials[id];
    if (!credential) {
      log.warn("Credential not found", { id });
      await log.flush();
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }
    
    // Build prompt
    const prompt = testConfigPrompt({
      id,
      type: credential.type,
      service: credential.service,
      account: credential.account,
      notes: credential.notes,
      scopes: credential.scopes,
    });
    
    // Generate test config via AI
    const result = await aiAssist({
      schema: TestConfigSchema,
      prompt,
      systemPrompt: TEST_CONFIG_SYSTEM_PROMPT,
      timeoutMs: 30000,
      maxValidationRetries: 2,
    });
    
    if (!result.success) {
      log.error("AI generation failed", { 
        error: result.error,
        attempts: result.attempts 
      });
      await log.flush();
      return NextResponse.json(
        { 
          error: "Failed to generate test config",
          message: result.error,
          attempts: result.attempts
        },
        { status: 500 }
      );
    }
    
    const generatedConfig = result.data;
    
    // Validate $VALUE placeholder is present
    if (!validateTestConfigPlaceholder(generatedConfig)) {
      log.warn("Generated config missing $VALUE placeholder", { 
        id,
        config: generatedConfig 
      });
      await log.flush();
      return NextResponse.json(
        { 
          error: "Invalid generated config",
          message: "Generated config does not include $VALUE placeholder"
        },
        { status: 500 }
      );
    }
    
    // Log the generated config for troubleshooting (headers redacted)
    const redactedHeaders = generatedConfig.headers
      ? Object.keys(generatedConfig.headers).reduce((acc, key) => {
          acc[key] = '[REDACTED]';
          return acc;
        }, {} as Record<string, string>)
      : undefined;
    
    log.info("Generated test config", { 
      id,
      service: credential.service,
      type: credential.type,
      generatedConfig: {
        method: generatedConfig.method,
        url: generatedConfig.url,
        expectStatus: generatedConfig.expectStatus,
        description: generatedConfig.description,
        // Only log header keys, not values (security)
        headerKeys: generatedConfig.headers ? Object.keys(generatedConfig.headers) : [],
      },
      attempts: result.attempts
    });
    
    // Convert to TestConfig format (remove description/notes which are AI extras)
    const testConfig: TestConfig = {
      method: generatedConfig.method,
      url: generatedConfig.url,
      headers: generatedConfig.headers as Record<string, string> | undefined,
      body: generatedConfig.body,
      expectStatus: generatedConfig.expectStatus,
    };
    
    // Save if requested (with optimistic locking)
    if (save) {
      // Check version for optimistic locking
      if (secrets._meta.updated !== expectedVersion) {
        log.warn("Version conflict", { 
          expected: expectedVersion, 
          actual: secrets._meta.updated 
        });
        await log.flush();
        return NextResponse.json(
          { 
            error: "Version conflict",
            message: "Secrets file was modified. Please refresh and try again.",
            currentVersion: secrets._meta.updated
          },
          { status: 409 }
        );
      }
      
      secrets.credentials[id].test = testConfig;
      secrets._meta.updated = new Date().toISOString();
      
      const writeRes = await fetch(`${FILE_SERVER_URL}/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: SECRETS_PATH,
          content: JSON.stringify(secrets, null, 2),
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!writeRes.ok) {
        log.error("Failed to save test config", { status: writeRes.status });
        await log.flush();
        return NextResponse.json(
          { error: "Generated config but failed to save" },
          { status: 500 }
        );
      }
      
      log.info("Saved test config", { id });
    }
    
    const totalDuration = Date.now() - startTime;
    log.info("Request completed", { totalDuration, attempts: result.attempts });
    await log.flush();
    
    return NextResponse.json({
      success: true,
      testConfig,
      description: generatedConfig.description,
      notes: generatedConfig.notes,
      saved: save,
      attempts: result.attempts,
      // AI output should be reviewed before use
      requiresUserConfirmation: true,
      // Include version for optimistic locking on subsequent saves
      version: secrets._meta.updated,
    });
    
  } catch (error) {
    log.error("Generation failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    await log.flush();
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 }
    );
  }
}
