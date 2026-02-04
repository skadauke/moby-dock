/**
 * Test Script Schema
 * 
 * Defines the structure for AI-generated credential test scripts.
 */

import { z } from "zod";

/**
 * Schema for a credential test script
 */
export const TestScriptSchema = z.object({
  /** Shell command to test the credential. Use $VALUE as placeholder for the secret. */
  testCommand: z
    .string()
    .describe("Shell command to test the credential. Use $VALUE as placeholder for the secret value."),
  
  /** What indicates the credential is valid (e.g., "HTTP 200", "authenticated") */
  successIndicator: z
    .string()
    .describe("What output or exit code indicates success (e.g., 'HTTP 200', 'exit 0')"),
  
  /** What indicates the credential itself is invalid vs other errors */
  authFailureIndicator: z
    .string()
    .describe("What indicates authentication failed specifically (e.g., 'HTTP 401', 'invalid_token')"),
  
  /** Brief explanation of what the test does */
  explanation: z
    .string()
    .describe("Brief explanation of what the test command does"),
});

export type TestScript = z.infer<typeof TestScriptSchema>;

/**
 * Schema for the result of running a test
 */
export const TestResultSchema = z.object({
  /** Whether the credential passed the test */
  passed: z.boolean(),
  /** Raw output from the test command */
  output: z.string(),
  /** Interpretation of the result */
  interpretation: z.enum(["valid", "invalid_credential", "error"]),
  /** Human-readable message */
  message: z.string(),
});

export type TestResult = z.infer<typeof TestResultSchema>;
