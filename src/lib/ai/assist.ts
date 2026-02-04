/**
 * AI Assist - Core function for AI-assisted features
 * 
 * Provides a reusable pattern for:
 * 1. Calling OpenAI with structured output (Zod schema)
 * 2. Validating the response
 * 3. Retrying with feedback if validation fails
 * 4. Returning typed, validated results
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { getOpenAI, DEFAULT_MODEL } from "./client";

export interface AiAssistOptions<T extends z.ZodTypeAny> {
  /** Zod schema for the expected output structure */
  schema: T;
  /** The main prompt to send to the AI */
  prompt: string;
  /** Optional system prompt to set AI behavior */
  systemPrompt?: string;
  /** Max retries for validation failures (default: 2) */
  maxValidationRetries?: number;
  /** OpenAI model to use (default: gpt-4o-mini) */
  model?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

export interface AiAssistSuccess<T> {
  success: true;
  data: T;
  attempts: number;
}

export interface AiAssistFailure {
  success: false;
  error: string;
  attempts: number;
}

export type AiAssistResult<T> = AiAssistSuccess<T> | AiAssistFailure;

/**
 * Call AI with structured output and validation retry
 * 
 * @example
 * ```ts
 * const result = await aiAssist({
 *   schema: z.object({ name: z.string(), age: z.number() }),
 *   prompt: "Extract name and age from: John is 30 years old",
 *   systemPrompt: "You are a data extraction assistant.",
 * });
 * 
 * if (result.success) {
 *   console.log(result.data.name, result.data.age);
 * }
 * ```
 */
export async function aiAssist<T extends z.ZodTypeAny>(
  options: AiAssistOptions<T>
): Promise<AiAssistResult<z.infer<T>>> {
  const {
    schema,
    prompt,
    systemPrompt,
    maxValidationRetries = 2,
    model = DEFAULT_MODEL,
    timeoutMs = 30000,
  } = options;

  let lastError: string | null = null;
  const maxAttempts = maxValidationRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Build the prompt, including error feedback on retries
      const currentPrompt = lastError
        ? `${prompt}\n\n---\nPrevious attempt failed validation: ${lastError}\nPlease fix the output and try again.`
        : prompt;

      const result = await generateText({
        model: getOpenAI()(model),
        output: Output.object({ schema }),
        system: systemPrompt,
        prompt: currentPrompt,
        maxRetries: 2, // API-level retries (rate limits, network errors)
        timeout: { totalMs: timeoutMs },
      });

      // Output is validated by the SDK against the schema at runtime
      // If we get here, it passed validation - cast to the expected type
      // The SDK guarantees the output matches the schema
      const validatedOutput = result.output as z.infer<T>;
      
      return {
        success: true,
        data: validatedOutput,
        attempts: attempt,
      };
    } catch (e) {
      const error = e as Error;
      
      // Check if this is a validation/parsing error (retryable)
      const isValidationError =
        error.name === "AI_JSONParseError" ||
        error.name === "AI_TypeValidationError" ||
        error.name === "ZodError" ||
        error.message?.includes("JSON") ||
        error.message?.includes("parse") ||
        error.message?.includes("validation");

      if (isValidationError && attempt < maxAttempts) {
        // Store error for feedback and retry
        lastError = error.message;
        continue;
      }

      // Non-recoverable error or max retries exceeded
      return {
        success: false,
        error: error.message || "Unknown error occurred",
        attempts: attempt,
      };
    }
  }

  // Should not reach here, but TypeScript needs this
  return {
    success: false,
    error: `Failed after ${maxAttempts} attempts: ${lastError}`,
    attempts: maxAttempts,
  };
}

/**
 * Check if the AI module is properly configured
 */
export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
