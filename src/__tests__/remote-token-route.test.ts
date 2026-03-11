/**
 * /api/remote/token Route Tests
 *
 * Tests for authentication and token retrieval in the remote token route.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/api-auth", () => ({
  checkApiAuth: vi.fn(),
}));

import { checkApiAuth } from "@/lib/api-auth";

const { GET } = await import("@/app/api/remote/token/route");

const TEST_TOKEN = "test-file-server-token-abc123";

describe("/api/remote/token", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    vi.mocked(checkApiAuth).mockReset();
    originalToken = process.env.MOBY_FILE_SERVER_TOKEN;
    process.env.MOBY_FILE_SERVER_TOKEN = TEST_TOKEN;
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.MOBY_FILE_SERVER_TOKEN = originalToken;
    } else {
      delete process.env.MOBY_FILE_SERVER_TOKEN;
    }
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ authenticated: false });

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 when MOBY_FILE_SERVER_TOKEN not set", async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ authenticated: true });
    delete process.env.MOBY_FILE_SERVER_TOKEN;

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("File server token not configured");
  });

  it("returns token when authenticated and token configured", async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ authenticated: true });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe(TEST_TOKEN);
  });

  it("does not leak token in error responses", async () => {
    // Test 401 response doesn't contain token
    vi.mocked(checkApiAuth).mockResolvedValue({ authenticated: false });
    const res401 = await GET();
    const text401 = JSON.stringify(await res401.json());
    expect(text401).not.toContain(TEST_TOKEN);

    // Test 500 response doesn't contain token
    vi.mocked(checkApiAuth).mockResolvedValue({ authenticated: true });
    delete process.env.MOBY_FILE_SERVER_TOKEN;
    const res500 = await GET();
    const text500 = JSON.stringify(await res500.json());
    expect(text500).not.toContain(TEST_TOKEN);
  });
});
