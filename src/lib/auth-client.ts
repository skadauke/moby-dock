"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Client configuration
  // baseURL is inferred from window.location in the browser
});

// Export hooks and functions
export const { signIn, signOut, useSession } = authClient;
