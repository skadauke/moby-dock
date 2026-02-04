/**
 * CSRF Protection Tests
 *
 * Tests for Origin header validation and CSRF middleware helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  validateCsrfOrigin,
  shouldCheckCsrf,
  isMutationMethod,
} from "@/lib/csrf";

// Helper to create mock NextRequest
function createMockRequest(options: {
  origin?: string;
  referer?: string;
  method?: string;
  pathname?: string;
}): NextRequest {
  const url = `https://moby-dock.vercel.app${options.pathname || "/api/test"}`;
  const headers = new Headers();

  if (options.origin) {
    headers.set("origin", options.origin);
  }
  if (options.referer) {
    headers.set("referer", options.referer);
  }

  return new NextRequest(url, {
    method: options.method || "POST",
    headers,
  });
}

describe("validateCsrfOrigin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("with Origin header", () => {
    it("allows requests from production domain", () => {
      const request = createMockRequest({
        origin: "https://moby-dock.vercel.app",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("allows requests from localhost", () => {
      const request = createMockRequest({
        origin: "http://localhost:3000",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("allows requests from 127.0.0.1", () => {
      const request = createMockRequest({
        origin: "http://127.0.0.1:3000",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("allows requests from Vercel preview deployments", () => {
      const request = createMockRequest({
        origin: "https://moby-dock-abc123-skadaukes-projects.vercel.app",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("allows requests from VERCEL_URL when set", async () => {
      process.env.VERCEL_URL = "moby-dock-preview-123.vercel.app";

      // Re-import module to pick up env change
      vi.resetModules();
      const { validateCsrfOrigin: validateWithEnv } = await import(
        "@/lib/csrf"
      );

      const request = createMockRequest({
        origin: "https://moby-dock-preview-123.vercel.app",
      });

      const result = validateWithEnv(request);
      expect(result.valid).toBe(true);
    });

    it("rejects requests from untrusted origins", () => {
      const request = createMockRequest({
        origin: "https://evil-site.com",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid origin");
    });

    it("rejects requests from similar-looking domains", () => {
      const request = createMockRequest({
        origin: "https://moby-dock.vercel.app.evil.com",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(false);
    });

    it("rejects requests from different ports", () => {
      const request = createMockRequest({
        origin: "http://localhost:3001",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(false);
    });
  });

  describe("with Referer header (fallback)", () => {
    it("allows requests with valid Referer when Origin missing", () => {
      const request = createMockRequest({
        referer: "https://moby-dock.vercel.app/some/page",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("allows localhost Referer", () => {
      const request = createMockRequest({
        referer: "http://localhost:3000/config",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("allows Vercel preview Referer", () => {
      const request = createMockRequest({
        referer:
          "https://moby-dock-git-feature-skadaukes-projects.vercel.app/vault",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid Referer", () => {
      const request = createMockRequest({
        referer: "https://attacker.com/csrf-page",
      });
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid referer");
    });
  });

  describe("with no Origin or Referer", () => {
    it("allows same-origin requests (no headers)", () => {
      // Same-origin requests from browsers don't include Origin
      const request = createMockRequest({});
      const result = validateCsrfOrigin(request);
      expect(result.valid).toBe(true);
    });
  });
});

describe("shouldCheckCsrf", () => {
  it("returns false for auth routes", () => {
    expect(shouldCheckCsrf("/api/auth")).toBe(false);
    expect(shouldCheckCsrf("/api/auth/callback/github")).toBe(false);
    expect(shouldCheckCsrf("/api/auth/sign-in")).toBe(false);
    expect(shouldCheckCsrf("/api/auth/session")).toBe(false);
  });

  it("returns true for routes that look similar to auth but are not", () => {
    // These should NOT be excluded from CSRF checking
    expect(shouldCheckCsrf("/api/authors")).toBe(true);
    expect(shouldCheckCsrf("/api/authorize")).toBe(true);
    expect(shouldCheckCsrf("/api/authentication")).toBe(true);
  });

  it("returns true for other API routes", () => {
    expect(shouldCheckCsrf("/api/files")).toBe(true);
    expect(shouldCheckCsrf("/api/gateway/restart")).toBe(true);
    expect(shouldCheckCsrf("/api/vault/secrets")).toBe(true);
    expect(shouldCheckCsrf("/api/tasks")).toBe(true);
  });

  it("returns false for non-API routes", () => {
    expect(shouldCheckCsrf("/config")).toBe(false);
    expect(shouldCheckCsrf("/vault")).toBe(false);
    expect(shouldCheckCsrf("/login")).toBe(false);
  });
});

describe("isMutationMethod", () => {
  it("returns true for mutation methods", () => {
    expect(isMutationMethod("POST")).toBe(true);
    expect(isMutationMethod("PUT")).toBe(true);
    expect(isMutationMethod("DELETE")).toBe(true);
    expect(isMutationMethod("PATCH")).toBe(true);
  });

  it("returns true for lowercase methods", () => {
    expect(isMutationMethod("post")).toBe(true);
    expect(isMutationMethod("delete")).toBe(true);
  });

  it("returns false for read methods", () => {
    expect(isMutationMethod("GET")).toBe(false);
    expect(isMutationMethod("HEAD")).toBe(false);
    expect(isMutationMethod("OPTIONS")).toBe(false);
  });
});
