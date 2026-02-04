/**
 * API Route: Test Credential
 * 
 * Executes a credential's test configuration to verify it works.
 * POST /api/vault/test
 */

import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { executeTest, validateTestUrl } from "@/lib/vault";
import type { Credential, SecretsFile, TestConfig, TestResult } from "@/lib/vault";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";
const SECRETS_PATH = "~/.openclaw/credentials/secrets.json";

interface RequestBody {
  /** Credential ID to test */
  id: string;
  /** Optional: override test config (for testing generated configs) */
  testConfig?: TestConfig;
  /** Whether to save the test result to the credential */
  saveResult?: boolean;
}

/**
 * Get the primary value from a credential
 */
function getCredentialValue(credential: Credential): string | null {
  // Try different value fields in order of priority
  return credential.value 
    ?? credential.auth_token 
    ?? credential.client_secret
    ?? credential.service_role_key
    ?? credential.anon_key
    ?? null;
}

export async function POST(request: Request) {
  const log = new Logger({ source: "api/vault/test" });
  const startTime = Date.now();
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to vault test");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  
  const { id, testConfig: overrideConfig, saveResult = true } = body;
  
  if (!id || typeof id !== 'string') {
    log.warn("Missing credential ID");
    await log.flush();
    return NextResponse.json({ error: "Missing credential ID" }, { status: 400 });
  }
  
  log.info("POST /api/vault/test", { 
    userId: session.user.id, 
    credentialId: id,
    hasOverrideConfig: !!overrideConfig,
    saveResult 
  });
  
  try {
    // Fetch secrets file
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
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
    
    // Get test config (override or stored)
    const testConfig = overrideConfig ?? credential.test;
    if (!testConfig) {
      log.info("No test config available", { id });
      await log.flush();
      return NextResponse.json({ 
        error: "No test configuration",
        message: "This credential has no test configured. Generate one using AI.",
        needsGeneration: true
      }, { status: 400 });
    }
    
    // Validate test config URL
    const urlValidation = validateTestUrl(testConfig.url);
    if (!urlValidation.valid) {
      log.warn("Invalid test URL", { id, url: testConfig.url, error: urlValidation.error });
      await log.flush();
      return NextResponse.json({ 
        error: "Invalid test configuration",
        message: urlValidation.error
      }, { status: 400 });
    }
    
    // Get credential value
    const credentialValue = getCredentialValue(credential);
    if (!credentialValue) {
      log.warn("Credential has no value", { id });
      await log.flush();
      return NextResponse.json({ 
        error: "Credential has no value to test"
      }, { status: 400 });
    }
    
    // Log the test config (for troubleshooting, as requested)
    log.info("Executing test", { 
      id, 
      service: credential.service,
      type: credential.type,
      testConfig: {
        method: testConfig.method,
        url: testConfig.url,
        expectStatus: testConfig.expectStatus,
        // Don't log headers as they may contain sensitive patterns
      }
    });
    
    // Execute test
    const result: TestResult = await executeTest(testConfig, credentialValue);
    
    log.info("Test completed", { 
      id, 
      success: result.success, 
      status: result.status,
      durationMs: result.durationMs 
    });
    
    // Save result if requested
    if (saveResult) {
      secrets.credentials[id].lastTestResult = result;
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
      });
      
      if (!writeRes.ok) {
        log.warn("Failed to save test result", { status: writeRes.status });
        // Don't fail the request, just log
      }
    }
    
    const totalDuration = Date.now() - startTime;
    log.info("Request completed", { totalDuration });
    await log.flush();
    
    return NextResponse.json({
      success: true,
      result,
    });
    
  } catch (error) {
    log.error("Test execution failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    await log.flush();
    return NextResponse.json(
      { error: "Test execution failed" },
      { status: 500 }
    );
  }
}
