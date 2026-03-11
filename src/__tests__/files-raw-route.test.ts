/**
 * /api/files/raw Route Tests
 *
 * Tests for path traversal protection in the raw file proxy route.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing the route
vi.mock("next-axiom", () => {
  class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
  }
  return { Logger: MockLogger };
});

vi.mock("@/lib/api-auth", () => ({
  checkApiAuth: vi.fn().mockResolvedValue({ authenticated: true }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { GET } = await import("@/app/api/files/raw/route");

function createRequest(path: string | null): NextRequest {
  const url = new URL("http://localhost:3000/api/files/raw");
  if (path !== null) {
    url.searchParams.set("path", path);
  }
  return new NextRequest(url);
}

describe("/api/files/raw", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("path traversal protection", () => {
    it("should block paths with .. segments", async () => {
      const res = await GET(createRequest("~/.openclaw/media/../credentials/secrets.json"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid path");
    });

    it("should block paths with backslash .. segments", async () => {
      const res = await GET(createRequest("~/.openclaw/media\\..\\credentials\\secrets.json"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid path");
    });

    it("should block bare .. path", async () => {
      const res = await GET(createRequest(".."));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid path");
    });

    it("should block path ending with ..", async () => {
      const res = await GET(createRequest("~/.openclaw/media/.."));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid path");
    });

    it("should allow legitimate media paths", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "image/png", "Content-Length": "1024" }),
        body: new ReadableStream(),
      });

      const res = await GET(createRequest("~/.openclaw/media/image.png"));
      expect(res.status).toBe(200);
    });

    it("should allow paths with dots that are not traversal", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "audio/mpeg" }),
        body: new ReadableStream(),
      });

      const res = await GET(createRequest("~/.openclaw/media/file.name.with.dots.mp3"));
      expect(res.status).toBe(200);
    });
  });

  describe("basic validation", () => {
    it("should require path parameter", async () => {
      const res = await GET(createRequest(null));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Path is required");
    });

    it("should reject non-media paths", async () => {
      const res = await GET(createRequest("~/.openclaw/credentials/secrets.json"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Only media paths are allowed");
    });
  });
});
