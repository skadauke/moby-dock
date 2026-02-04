import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { Logger } from "next-axiom";

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
    // Session expiry (7 days)
    expiresIn: 60 * 60 * 24 * 7,
    // Cookie cache - store session in cookie to avoid DB lookups
    // Since we don't have a DB adapter, this IS our session storage
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days (match session expiry)
    },
  },
  advanced: {
    // Use secure cookies in production
    useSecureCookies: true,
    // NOTE: crossSubDomainCookies disabled because .vercel.app is a public suffix
    // Browsers block cookies on public suffixes for security reasons
    // Preview deployments will need to redirect to production for auth
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const log = new Logger({ source: "auth" });
      
      // Log auth attempts
      if (ctx.path.includes("/sign-in") || ctx.path.includes("/sign-out") || ctx.path.includes("/callback")) {
        log.info("Auth request", { 
          path: ctx.path,
          method: ctx.request?.method 
        });
        await log.flush();
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const log = new Logger({ source: "auth" });
      
      // After sign-in, check if user is allowed
      if (ctx.path.startsWith("/callback/github")) {
        const session = ctx.context.newSession;
        if (session?.user) {
          const username = (session.user as { username?: string }).username;
          if (!username || !ALLOWED_USERS.includes(username)) {
            // Log unauthorized access attempt
            log.warn("Auth denied - user not in allowlist", { 
              username,
              userId: session.user.id 
            });
            await log.flush();
            throw new APIError("FORBIDDEN", {
              message: "Access denied. Your GitHub account is not authorized.",
            });
          }
          // Log successful sign-in
          log.info("Auth success - user signed in", { 
            username,
            userId: session.user.id 
          });
          await log.flush();
        }
      }
      
      // Log sign-out
      if (ctx.path.includes("/sign-out")) {
        log.info("Auth sign-out");
        await log.flush();
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
