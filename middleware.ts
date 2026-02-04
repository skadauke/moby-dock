import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { Logger } from "next-axiom";
import {
  validateCsrfOrigin,
  shouldCheckCsrf,
  isMutationMethod,
} from "@/lib/csrf";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const log = new Logger({ source: "middleware" });
  const pathname = request.nextUrl.pathname;

  // Log the request
  log.info("Request", {
    method: request.method,
    path: pathname,
    userAgent: request.headers.get("user-agent")?.slice(0, 100),
  });

  // CSRF protection for mutation requests on API routes
  if (isMutationMethod(request.method) && shouldCheckCsrf(pathname)) {
    const csrfResult = validateCsrfOrigin(request);
    if (!csrfResult.valid) {
      log.warn("CSRF validation failed", {
        path: pathname,
        method: request.method,
        error: csrfResult.error,
      });
      event.waitUntil(log.flush());
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      );
    }
  }

  // Skip auth for preview deployments (URLs are obscure/temporary)
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (isPreview) {
    event.waitUntil(log.flush());
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const isLoggedIn = !!sessionCookie;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api");

  // Allow all API routes (they have their own auth)
  if (isApiRoute) {
    event.waitUntil(log.flush());
    return NextResponse.next();
  }

  // Redirect logged-in users away from login page
  if (isLoginPage && isLoggedIn) {
    log.info("Redirecting logged-in user from login to /command");
    event.waitUntil(log.flush());
    return NextResponse.redirect(new URL("/command", request.url));
  }

  // Redirect non-logged-in users to login page
  if (!isLoginPage && !isLoggedIn) {
    log.info("Redirecting unauthenticated user to login", { path: request.nextUrl.pathname });
    event.waitUntil(log.flush());
    return NextResponse.redirect(new URL("/login", request.url));
  }

  event.waitUntil(log.flush());
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
