import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { Logger } from "next-axiom";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const log = new Logger({ source: "middleware" });
  
  // Log the request
  log.info("Request", {
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent")?.slice(0, 100),
  });

  // Skip auth for preview deployments (URLs are obscure/temporary)
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (isPreview) {
    event.waitUntil(log.flush());
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const isLoggedIn = !!sessionCookie;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isApiAuth = request.nextUrl.pathname.startsWith("/api/auth");

  // Allow auth API routes
  if (isApiAuth) {
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
