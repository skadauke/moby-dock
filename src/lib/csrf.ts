/**
 * CSRF Protection Utilities
 *
 * Implements Origin header validation for CSRF protection.
 * This is an OWASP-recommended defense against cross-site request forgery.
 *
 * @module lib/csrf
 */

import { NextRequest } from "next/server";

/**
 * Allowed origins for CSRF validation.
 * Includes production domain, localhost for development, and Vercel preview URLs.
 */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "https://moby-dock.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  // Add current Vercel deployment URL if available
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  // Add custom BETTER_AUTH_URL if set (extract origin to handle paths/trailing slashes)
  if (process.env.BETTER_AUTH_URL) {
    try {
      const parsed = new URL(process.env.BETTER_AUTH_URL);
      origins.add(parsed.origin);
    } catch {
      // Invalid URL, skip
    }
  }

  return origins;
}

/**
 * Extract origin from a URL string, handling edge cases.
 */
function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Validates the Origin header for CSRF protection.
 *
 * OWASP recommends checking the Origin header (or Referer as fallback)
 * to verify requests come from trusted sources.
 *
 * Rules:
 * - If Origin header is present, it must match an allowed origin
 * - If Origin is missing, check Referer header as fallback
 * - If both are missing, the request is same-origin (browsers always send
 *   Origin on cross-origin requests), so allow it
 *
 * @param request - The incoming Next.js request
 * @returns Object with valid boolean and optional error message
 */
export function validateCsrfOrigin(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins();

  // If Origin header is present, validate it
  if (origin) {
    if (allowedOrigins.has(origin)) {
      return { valid: true };
    }

    // Check if it's a Vercel preview deployment (pattern: *-skadaukes-projects.vercel.app)
    // This allows any preview deployment from the same Vercel team
    if (
      origin.match(/^https:\/\/[a-z0-9-]+-skadaukes-projects\.vercel\.app$/)
    ) {
      return { valid: true };
    }

    return {
      valid: false,
      error: "Invalid origin",
    };
  }

  // Fallback: check Referer header
  if (referer) {
    const refererOrigin = extractOrigin(referer);
    if (refererOrigin && allowedOrigins.has(refererOrigin)) {
      return { valid: true };
    }

    // Check Vercel preview pattern for referer
    if (
      refererOrigin?.match(
        /^https:\/\/[a-z0-9-]+-skadaukes-projects\.vercel\.app$/
      )
    ) {
      return { valid: true };
    }

    // Referer present but not from allowed origin
    return {
      valid: false,
      error: "Invalid referer",
    };
  }

  // No Origin or Referer header
  // This typically means same-origin request (browsers always send Origin on cross-origin)
  // However, some older browsers or non-browser clients might not send it
  // For API endpoints, we allow this since they already require session auth
  return { valid: true };
}

/**
 * Check if a request path should have CSRF protection.
 * Excludes auth-related paths that handle their own CSRF.
 */
export function shouldCheckCsrf(pathname: string): boolean {
  // Exclude Better Auth routes - they have their own CSRF handling
  // Use exact match or prefix with slash to avoid matching /api/authors etc.
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return false;
  }

  // All other API routes should be checked
  return pathname.startsWith("/api/");
}

/**
 * Check if request method is a mutation (state-changing) method.
 */
export function isMutationMethod(method: string): boolean {
  return ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
}
