import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = new Logger({ source: "api/memory/sessions/[id]" });
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    log.warn("Unauthorized session detail attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const agent = request.nextUrl.searchParams.get("agent") || "main";
  const agentParam = `?agent=${encodeURIComponent(agent)}`;

  log.info("GET /api/memory/sessions/[id]", { sessionId: id, agent });

  try {
    const startTime = Date.now();
    const res = await fetch(
      `${FILE_SERVER_URL}/memory/session/${encodeURIComponent(id)}${agentParam}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!res.ok) {
      const resErr = await res.json().catch(() => ({ error: res.statusText }));
      log.error("Failed to load session", { sessionId: id, status: res.status });
      await log.flush();
      return NextResponse.json(
        { error: resErr.error || "Failed to load session" },
        { status: res.status }
      );
    }
    const data = await res.json();
    const duration = Date.now() - startTime;
    log.info("GET /api/memory/sessions/[id] success", { sessionId: id, duration });
    await log.flush();
    return NextResponse.json(data);
  } catch (error) {
    log.error("Failed to connect to file server", { sessionId: id, error: String(error) });
    await log.flush();
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 500 }
    );
  }
}
