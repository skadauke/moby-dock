import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/auth/github-url
 * Returns the GitHub OAuth URL for Safari iOS compatibility.
 * Safari blocks JS-initiated redirects, so we return the URL
 * and let the client navigate to it directly.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callbackURL = searchParams.get("callbackURL") || "/command";
  
  try {
    // Use Better Auth's API to get the OAuth URL
    const response = await auth.api.signInSocial({
      body: {
        provider: "github",
        callbackURL,
      },
      headers: request.headers,
      asResponse: true, // Get the Response object
    });
    
    // The response should be a redirect - extract the Location header
    const location = response.headers.get("Location");
    
    if (location) {
      return NextResponse.json({ url: location });
    }
    
    // If no redirect, return error
    return NextResponse.json(
      { error: "Failed to get OAuth URL" },
      { status: 500 }
    );
  } catch (error) {
    console.error("GitHub URL error:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth" },
      { status: 500 }
    );
  }
}
