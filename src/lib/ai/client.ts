/**
 * AI Client Configuration
 * 
 * Sets up the OpenAI provider for the Vercel AI SDK.
 * The API key is loaded from environment variables (Vercel env vars in production).
 */

import { createOpenAI } from "@ai-sdk/openai";

// Create OpenAI provider instance
// API key comes from OPENAI_API_KEY env var (set in Vercel)
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default model for AI-assisted features
// gpt-4o-mini is fast, cheap, and excellent at structured output
export const DEFAULT_MODEL = "gpt-4o-mini";
