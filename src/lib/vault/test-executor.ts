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

/** Blocked URL patterns (internal networks, localhost) */
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/0\.0\.0\.0/,
];

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
    
    // Check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(url)) {
        return { valid: false, error: 'Internal/localhost URLs not allowed' };
      }
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
