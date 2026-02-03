"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Production URL for OAuth
const PRODUCTION_URL = process.env.NEXT_PUBLIC_AUTH_URL || "https://moby-dock.vercel.app";

// Check if we're on the production/auth host (including localhost for dev)
function checkIsProduction(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  
  // Derive production hostname from PRODUCTION_URL
  let prodHostname = "moby-dock.vercel.app";
  try {
    prodHostname = new URL(PRODUCTION_URL).hostname;
  } catch {
    // Fall back to default if URL parsing fails
  }
  
  return hostname === prodHostname || 
         hostname === "localhost" || 
         hostname === "127.0.0.1";
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Derive returnUrl from searchParams (for preview deployment redirects)
  const returnUrl = useMemo(() => {
    return searchParams.get("returnTo");
  }, [searchParams]);

  // Check for error in URL (from OAuth callback failures)
  const urlError = useMemo(() => {
    return searchParams.get("error");
  }, [searchParams]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const isProduction = checkIsProduction();
      
      if (!isProduction) {
        // On preview deployment: redirect to production login with return URL
        const currentUrl = window.location.origin;
        const productionLoginUrl = `${PRODUCTION_URL}/login?returnTo=${encodeURIComponent(currentUrl)}`;
        window.location.href = productionLoginUrl;
        return;
      }
      
      // On production: do the OAuth flow
      // Store returnUrl in sessionStorage for post-auth redirect (if external)
      if (returnUrl && returnUrl.startsWith("http")) {
        sessionStorage.setItem("auth_return_url", returnUrl);
      }
      
      // Get the OAuth URL from our server endpoint, then navigate directly
      // This avoids Safari iOS blocking JS-initiated redirects
      const response = await fetch(
        `${PRODUCTION_URL}/api/auth/github-url?callbackURL=${encodeURIComponent("/command")}`,
        { credentials: "include" }
      );
      
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to start sign in");
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      if (data.url) {
        // Direct navigation to GitHub OAuth URL - Safari allows this
        window.location.href = data.url;
        return;
      }
      
      setError("Failed to get sign in URL");
      setIsLoading(false);
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
      setIsLoading(false);
    }
  };

  const displayError = error || urlError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <Card className="w-[400px] bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="text-5xl mb-4">🐋</div>
          <CardTitle className="text-2xl text-zinc-100">Moby Dock</CardTitle>
          <CardDescription className="text-zinc-400">
            Sign in to manage your AI assistant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md">
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Sign in with GitHub
              </>
            )}
          </Button>
          {returnUrl && (
            <p className="text-xs text-blue-400 text-center mt-2">
              You&apos;ll be redirected back to preview after sign in
            </p>
          )}
          <p className="text-xs text-zinc-500 text-center mt-4">
            Only authorized users can access this app
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
