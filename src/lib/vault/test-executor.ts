/**
 * Test Executor
 * 
 * Executes structured test configurations to verify credentials
 */

import { TestConfig, TestResult } from './types';

/** Placeholder for credential value in test configs */
const VALUE_PLACEHOLDER = '$VALUE';

/** Allowed URL protocols */
const ALLOWED_PROTOCOLS = ['https:'];

/**
 * SSRF domain allowlist: intentionally NOT implemented.
 *
 * Rationale (2026-03-08):
 * - This app runs on Vercel (serverless). There is no internal network,
 *   no localhost services, no LAN — outbound requests go straight to the
 *   public internet. The classic SSRF threat (reaching internal infra via
 *   server-side request) does not apply.
 * - The vault is single-owner. Only the authenticated owner can create
 *   test configs. If an attacker has write access to test configs, they
 *   already have the credentials themselves, making exfiltration via test
 *   redundant.
 * - A domain allowlist creates ongoing maintenance burden — every new
 *   service requires a code change and redeploy.
 *
 * We still enforce HTTPS-only to prevent credentials from leaking over
 * plaintext HTTP.
 */

/**
 * Validate a test config URL for safety
 */
export function validateTestUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Must be HTTPS
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} not allowed. Use HTTPS.` };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Substitute $VALUE placeholder with actual credential value
 */
function substituteValue(template: string, value: string): string {
  return template.replace(/\$VALUE/g, value);
}

/**
 * Execute a test configuration against a credential
 * 
 * @param config - The test configuration
 * @param credentialValue - The actual credential value to test
 * @returns Test result
 */
export async function executeTest(
  config: TestConfig,
  credentialValue: string
): Promise<TestResult> {
  const startTime = Date.now();
  
  // Validate URL
  const urlValidation = validateTestUrl(config.url);
  if (!urlValidation.valid) {
    return {
      success: false,
      status: 0,
      message: `URL validation failed: ${urlValidation.error}`,
      testedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }
  
  try {
    // Build request with $VALUE substitution
    const url = substituteValue(config.url, credentialValue);
    const headers: Record<string, string> = {};
    
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = substituteValue(value, credentialValue);
      }
    }
    
    const fetchOptions: RequestInit = {
      method: config.method,
      headers,
    };
    
    if (config.body && ['POST', 'PUT'].includes(config.method)) {
      fetchOptions.body = substituteValue(config.body, credentialValue);
    }
    
    // Execute request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const durationMs = Date.now() - startTime;
    
    // Check status
    const expectedStatuses = Array.isArray(config.expectStatus) 
      ? config.expectStatus 
      : [config.expectStatus];
    
    const statusMatch = expectedStatuses.includes(response.status);
    
    // Check body if required
    let bodyMatch = true;
    if (config.expectBodyContains && statusMatch) {
      const body = await response.text();
      bodyMatch = body.includes(config.expectBodyContains);
    }
    
    const success = statusMatch && bodyMatch;
    
    let message: string;
    if (success) {
      message = `Valid - received ${response.status}`;
    } else if (!statusMatch) {
      message = `Invalid - expected ${expectedStatuses.join(' or ')}, got ${response.status}`;
    } else {
      message = `Invalid - response body did not contain expected content`;
    }
    
    return {
      success,
      status: response.status,
      message,
      testedAt: new Date().toISOString(),
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    let message = 'Test failed';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        message = 'Request timed out (30s)';
      } else {
        message = `Network error: ${error.message}`;
      }
    }
    
    return {
      success: false,
      status: 0,
      message,
      testedAt: new Date().toISOString(),
      durationMs,
    };
  }
}
