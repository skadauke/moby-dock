import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Logger } from "next-axiom";

export async function GET() {
  const log = new Logger({ source: "api/terminal/token" });
  log.info("GET /api/terminal/token");

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    log.warn("Unauthorized terminal token request");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("Terminal token requested", { userId: session.user.id });

  const token = process.env.MOBY_FILE_SERVER_TOKEN;
  if (!token) {
    log.error("Terminal not configured - missing MOBY_FILE_SERVER_TOKEN");
    await log.flush();
    return NextResponse.json(
      { error: "Terminal not configured" },
      { status: 500 }
    );
  }

  // Convert FILE_SERVER_URL (https://...) to wss://...
  const fileServerUrl = process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
  const wsUrl = fileServerUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

  log.info("Terminal token generated", { userId: session.user.id });
  await log.flush();
  return NextResponse.json({
    token,
    url: `${wsUrl}/terminal`,
  });
}
