/**
 * Test Config Schema
 * 
 * Zod schema for AI-generated structured test configurations
 */

import { z } from 'zod';

/**
 * HTTP methods allowed in test configs
 */
const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD']);

/**
 * Structured test configuration schema
 * 
 * Generates safe, executable test configs for credential verification.
 * Uses $VALUE as placeholder for the credential value.
 */
export const TestConfigSchema = z.object({
  /** HTTP method for the test request */
  method: HttpMethodSchema
    .describe('HTTP method (GET, POST, PUT, DELETE, HEAD)'),
  
  /** URL to test - must be HTTPS and the service\'s official API */
  url: z.string()
    .url()
    .startsWith('https://')
    .describe('HTTPS URL to test against - must be the service\'s official API endpoint'),
  
  /** Headers to include - use $VALUE as placeholder for credential */
  headers: z.record(z.string(), z.string())
    .optional()
    .describe('Request headers - use $VALUE as placeholder for the credential value'),
  
  /** Request body for POST/PUT requests */
  body: z.string()
    .optional()
    .describe('Request body for POST/PUT - use $VALUE if needed'),
  
  /** Expected HTTP status code(s) for success */
  expectStatus: z.union([
    z.number().int().min(100).max(599),
    z.array(z.number().int().min(100).max(599))
  ]).describe('Expected HTTP status code(s) - usually 200 for success'),
  
  /** Description of what this test verifies */
  description: z.string()
    .describe('Brief description of what this test verifies'),
  
  /** Notes about the test (permissions needed, etc.) */
  notes: z.string()
    .describe('Additional notes (required permissions, rate limits, etc.)'),
});

export type GeneratedTestConfig = z.infer<typeof TestConfigSchema>;

/**
 * Validate that the generated config has proper $VALUE usage
 */
export function validateTestConfigPlaceholder(config: GeneratedTestConfig): boolean {
  // Check if $VALUE appears somewhere in headers or body
  const headersStr = config.headers ? JSON.stringify(config.headers) : '';
  const bodyStr = config.body ?? '';
  
  return headersStr.includes('$VALUE') || bodyStr.includes('$VALUE') || config.url.includes('$VALUE');
}
