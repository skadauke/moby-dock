import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

/**
 * Parse JSONL content into session messages.
 */
function parseJsonlMessages(content: string) {
  const lines = content.split("\n").filter((l) => l.trim());
  const messages = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.role) messages.push(obj);
    } catch {
      /* skip malformed lines */
    }
  }
  return messages;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const fileParam = request.nextUrl.searchParams.get("file");

  // If a file path is provided, read it directly via the file-read API
  if (fileParam) {
    try {
      const res = await fetch(
        `${FILE_SERVER_URL}/files?path=${encodeURIComponent(fileParam)}`,
        {
          headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
          signal: AbortSignal.timeout(30000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const content = data.content ?? "";
        const messages = parseJsonlMessages(content);
        return NextResponse.json({
          sessionId: id,
          messageCount: messages.length,
          messages,
        });
      }
      // If direct file read fails, fall through to legacy endpoint
    } catch {
      // Fall through to legacy endpoint
    }
  }

  // Fallback: try the legacy /memory/session/<id> endpoint
  try {
    const res = await fetch(
      `${FILE_SERVER_URL}/memory/session/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json(
        { error: err.error || "Failed to load session" },
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
