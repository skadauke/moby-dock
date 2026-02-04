/**
 * AI Client Configuration
 * 
 * Sets up the OpenAI provider for the Vercel AI SDK.
 * The API key is loaded from environment variables (Vercel env vars in production).
 * 
 * NOTE: The client is lazily instantiated to avoid errors when checking AI status
 * without a configured API key.
 */

import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";

// Default model for AI-assisted features
// gpt-4o-mini is fast, cheap, and excellent at structured output
export const DEFAULT_MODEL = "gpt-4o-mini";

// Lazy-loaded OpenAI provider instance
let _openai: OpenAIProvider | null = null;

/**
 * Get the OpenAI provider instance (lazy-loaded)
 * Throws if OPENAI_API_KEY is not configured
 */
export function getOpenAI(): OpenAIProvider {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    _openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}
