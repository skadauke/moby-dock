/**
 * Tests for AI Schemas
 */

import { describe, it, expect } from "vitest";
import { TestScriptSchema, RotationInfoSchema } from "@/lib/ai";

describe("TestScriptSchema", () => {
  it("accepts valid test script with $VALUE placeholder", () => {
    const validScript = {
      testCommand: 'curl -H "Authorization: Bearer $VALUE" https://api.example.com/me',
      successIndicator: "HTTP 200",
      authFailureIndicator: "HTTP 401",
      explanation: "Tests API key by fetching user info",
    };

    const result = TestScriptSchema.safeParse(validScript);
    expect(result.success).toBe(true);
  });

  it("rejects command without $VALUE placeholder", () => {
    const invalidScript = {
      testCommand: 'curl https://api.example.com/me',
      successIndicator: "HTTP 200",
      authFailureIndicator: "HTTP 401",
      explanation: "Missing placeholder",
    };

    const result = TestScriptSchema.safeParse(invalidScript);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("$VALUE");
    }
  });

  it("rejects command with newlines", () => {
    const invalidScript = {
      testCommand: 'curl $VALUE\nrm -rf /',
      successIndicator: "HTTP 200",
      authFailureIndicator: "HTTP 401",
      explanation: "Multi-line command",
    };

    const result = TestScriptSchema.safeParse(invalidScript);
    expect(result.success).toBe(false);
  });

  it("rejects command with semicolons", () => {
    const invalidScript = {
      testCommand: 'curl $VALUE; rm -rf /',
      successIndicator: "HTTP 200",
      authFailureIndicator: "HTTP 401",
      explanation: "Command chaining with semicolon",
    };

    const result = TestScriptSchema.safeParse(invalidScript);
    expect(result.success).toBe(false);
  });

  it("rejects command with && chaining", () => {
    const invalidScript = {
      testCommand: 'curl $VALUE && rm -rf /',
      successIndicator: "HTTP 200",
      authFailureIndicator: "HTTP 401",
      explanation: "Command chaining with &&",
    };

    const result = TestScriptSchema.safeParse(invalidScript);
    expect(result.success).toBe(false);
  });
});

describe("RotationInfoSchema", () => {
  it("accepts valid rotation info", () => {
    const validInfo = {
      rotationUrl: "https://github.com/settings/tokens",
      pageName: "Personal Access Tokens",
      instructions: [
        "Navigate to Settings",
        "Click Generate new token",
        "Copy the new token",
      ],
      immediateInvalidation: true,
      warnings: ["Old token stops working immediately"],
    };

    const result = RotationInfoSchema.safeParse(validInfo);
    expect(result.success).toBe(true);
  });

  it("accepts rotation info without optional warnings", () => {
    const validInfo = {
      rotationUrl: "https://example.com/settings",
      pageName: "API Keys",
      instructions: ["Step 1", "Step 2"],
      immediateInvalidation: false,
    };

    const result = RotationInfoSchema.safeParse(validInfo);
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const invalidInfo = {
      rotationUrl: "not-a-valid-url",
      pageName: "Settings",
      instructions: ["Step 1"],
      immediateInvalidation: true,
    };

    const result = RotationInfoSchema.safeParse(invalidInfo);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const invalidInfo = {
      rotationUrl: "https://example.com",
      // missing pageName, instructions, immediateInvalidation
    };

    const result = RotationInfoSchema.safeParse(invalidInfo);
    expect(result.success).toBe(false);
  });
});
