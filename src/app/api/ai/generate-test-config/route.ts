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
import type { TestConfig } from "@/lib/vault";
import { readVault, writeVault } from "@/lib/vault/server-helpers";

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
    // Read vault (auto-migrates v2 → v3)
    const vault = await readVault();
    
    // Find item
    const item = vault.items.find((i) => i.id === id);
    if (!item) {
      log.warn("Credential not found", { id });
      await log.flush();
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }
    
    // Build prompt
    const prompt = testConfigPrompt({
      id,
      type: item.type,
      service: item.service || "",
      account: item.username,
      notes: item.notes,
      scopes: item.fields?.scope ? [item.fields.scope as string] : undefined,
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
        method: generatedConfig.method,
        // Don't log full config - may contain sensitive patterns
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
    
    // Log minimal config info for troubleshooting (no URLs/headers - may contain sensitive patterns)
    log.info("Generated test config", { 
      id,
      service: item.service,
      type: item.type,
      method: generatedConfig.method,
      expectStatus: generatedConfig.expectStatus,
      hasHeaders: !!generatedConfig.headers,
      hasBody: !!generatedConfig.body,
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
    
    // Save if requested
    if (save) {
      item.test = testConfig;
      await writeVault(vault);
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
      requiresUserConfirmation: true,
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
