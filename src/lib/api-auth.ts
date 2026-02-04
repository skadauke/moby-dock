/**
 * API Authentication Helper
 * 
 * Supports two auth methods for single-user app:
 * 1. Browser session cookie (for web UI)
 * 2. Bearer token (for Moby/server-side calls)
 * 
 * @module lib/api-auth
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const MOBY_API_TOKEN = process.env.MOBY_API_TOKEN || "";

interface AuthResult {
  authenticated: boolean;
  userId: string | null;
  method: "session" | "token" | null;
}

/**
 * Check if request is authenticated via session or Bearer token
 */
export async function checkApiAuth(): Promise<AuthResult> {
  // First, try session auth (browser)
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    return {
      authenticated: true,
      userId: session.user.id,
      method: "session",
    };
  }

  // Then, try Bearer token auth (Moby)
  if (MOBY_API_TOKEN) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (token === MOBY_API_TOKEN) {
        return {
          authenticated: true,
          userId: "moby", // Service account identifier
          method: "token",
        };
      }
    }
  }

  return {
    authenticated: false,
    userId: null,
    method: null,
  };
}
