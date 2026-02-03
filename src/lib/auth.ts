import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";

// Allowed GitHub usernames (for private access)
const ALLOWED_USERS = ["skadauke"];

// Production URL for OAuth callbacks - must match GitHub OAuth app settings
const PRODUCTION_URL = process.env.BETTER_AUTH_URL || "https://moby-dock.vercel.app";

// Build trusted origins list including Vercel preview deployments
const trustedOriginsList = [
  PRODUCTION_URL,
  "https://moby-dock.vercel.app",
  // Allow localhost for development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// Add Vercel preview deployment pattern if we can detect it
// Vercel preview URLs follow pattern: https://<project>-<hash>-<team>.vercel.app
if (process.env.VERCEL_URL) {
  trustedOriginsList.push(`https://${process.env.VERCEL_URL}`);
}

export const auth = betterAuth({
  // Always use production URL for OAuth callbacks
  // This ensures GitHub OAuth works on preview deployments
  baseURL: PRODUCTION_URL,
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  
  // Trust Vercel preview deployment origins for cross-origin auth requests
  trustedOrigins: trustedOriginsList,
  
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // Map GitHub profile fields
      mapProfileToUser: (profile) => ({
        name: profile.name || profile.login,
        email: profile.email,
        image: profile.avatar_url,
        // Store GitHub username for access control
        username: profile.login,
      }),
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    // Use secure cookies with SameSite=None for Safari/iOS compatibility
    useSecureCookies: true,
    // Allow cross-site cookies for preview deployments
    crossSubDomainCookies: {
      enabled: true,
      domain: ".vercel.app", // Share cookies across all vercel.app subdomains
    },
    // Explicitly set cookie attributes for iOS Safari compatibility
    cookies: {
      session_token: {
        attributes: {
          sameSite: "none" as const,
          secure: true,
          httpOnly: true,
          path: "/",
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Intercept OAuth callback to check allowed users
      if (ctx.path === "/callback/github") {
        // The user info is in the OAuth state/profile after callback
        // We'll check in the after hook once we have the user
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // After sign-in, check if user is allowed
      if (ctx.path.startsWith("/callback/github")) {
        const session = ctx.context.newSession;
        if (session?.user) {
          const username = (session.user as { username?: string }).username;
          if (!username || !ALLOWED_USERS.includes(username)) {
            // User not allowed - we need to sign them out
            // and return an error
            throw new APIError("FORBIDDEN", {
              message: "Access denied. Your GitHub account is not authorized.",
            });
          }
        }
      }
    }),
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  plugins: [nextCookies()],
});

// Export type for session
export type Session = typeof auth.$Infer.Session;
