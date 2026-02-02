import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";

// Allowed GitHub usernames (for private access)
const ALLOWED_USERS = ["skadauke"];

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
