import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

export async function GET(request: NextRequest) {
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  const limit = request.nextUrl.searchParams.get("limit") || "50";

  try {
    const res = await fetch(
      `${FILE_SERVER_URL}/memory/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json(
        { error: err.error || "Search failed" },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 500 }
    );
  }
}
