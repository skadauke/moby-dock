/**
 * Tests for AI Assist module
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => ({ schema })),
  },
}));

// Mock the client
vi.mock("@/lib/ai/client", () => ({
  getOpenAI: vi.fn(() => vi.fn(() => "mock-model")),
  DEFAULT_MODEL: "gpt-4o-mini",
}));

import { aiAssist, isAiConfigured } from "@/lib/ai/assist";
import { generateText } from "ai";

describe("aiAssist", () => {
  const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testSchema = z.object({
    name: z.string(),
    value: z.number(),
  });

  it("returns success with valid AI response", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { name: "test", value: 42 },
    });

    const result = await aiAssist({
      schema: testSchema,
      prompt: "Generate test data",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "test", value: 42 });
      expect(result.attempts).toBe(1);
    }
  });

  it("retries on validation error with feedback", async () => {
    // First call fails validation
    mockGenerateText.mockRejectedValueOnce(
      new Error("JSON parse error: invalid format")
    );
    // Second call succeeds
    mockGenerateText.mockResolvedValueOnce({
      output: { name: "test", value: 42 },
    });

    const result = await aiAssist({
      schema: testSchema,
      prompt: "Generate test data",
      maxValidationRetries: 2,
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    // Verify retry included error feedback
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("fails after max retries exceeded", async () => {
    mockGenerateText.mockRejectedValue(
      new Error("JSON parse error: invalid format")
    );

    const result = await aiAssist({
      schema: testSchema,
      prompt: "Generate test data",
      maxValidationRetries: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
      expect(result.error).toContain("JSON parse error");
    }
  });

  it("does not retry on non-validation errors", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("Network error"));

    const result = await aiAssist({
      schema: testSchema,
      prompt: "Generate test data",
      maxValidationRetries: 2,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("uses custom model when provided", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: { name: "test", value: 42 },
    });

    await aiAssist({
      schema: testSchema,
      prompt: "Generate test data",
      model: "gpt-4o",
    });

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
      })
    );
  });
});

describe("isAiConfigured", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns true when OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    
    // Re-import to get fresh module
    const { isAiConfigured } = await import("@/lib/ai/assist");
    expect(isAiConfigured()).toBe(true);
  });

  it("returns false when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    
    const { isAiConfigured } = await import("@/lib/ai/assist");
    expect(isAiConfigured()).toBe(false);
  });
});
