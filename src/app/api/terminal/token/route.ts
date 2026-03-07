import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.MOBY_FILE_SERVER_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Terminal not configured" },
      { status: 500 }
    );
  }

  // Convert FILE_SERVER_URL (https://...) to wss://...
  const fileServerUrl = process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
  const wsUrl = fileServerUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

  return NextResponse.json({
    token,
    url: `${wsUrl}/terminal`,
  });
}
