"use client";

import { createAuthClient } from "better-auth/react";

// Production URL for OAuth - must match server config
const PRODUCTION_URL = process.env.NEXT_PUBLIC_AUTH_URL || "https://moby-dock.vercel.app";

export const authClient = createAuthClient({
  // Always use production URL for auth API calls
  // This ensures OAuth callbacks work and cookies are shared via .vercel.app domain
  baseURL: PRODUCTION_URL,
});

// Export hooks and functions for convenience
export const { signIn, signOut, useSession } = authClient;
