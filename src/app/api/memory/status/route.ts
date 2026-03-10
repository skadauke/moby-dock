import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

export async function GET() {
  const log = new Logger({ source: "api/memory/status" });
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    log.warn("Unauthorized memory status attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("GET /api/memory/status");

  try {
    const res = await fetch(`${FILE_SERVER_URL}/memory/status`, {
      headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const resErr = await res.json().catch(() => ({ error: res.statusText }));
      log.error("Memory status failed", { status: res.status });
      await log.flush();
      return NextResponse.json(
        { error: resErr.error || "Status failed" },
        { status: res.status }
      );
    }
    const data = await res.json();
    log.info("GET /api/memory/status success");
    await log.flush();
    return NextResponse.json(data);
  } catch (error) {
    log.error("Failed to connect to file server", { error: String(error) });
    await log.flush();
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 500 }
    );
  }
}
