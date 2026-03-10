import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.NEXT_PUBLIC_FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- req needed for searchParams
export async function GET(req: NextRequest) {
  const log = new Logger({ source: "api/logs" });

  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized logs access attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pass all query params through to file server
  const params = req.nextUrl.searchParams;
  const queryString = params.toString();

  const start = Date.now();
  try {
    const res = await fetch(
      `${FILE_SERVER_URL}/logs${queryString ? `?${queryString}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ error: "Unknown error" }));
      log.error("File server logs request failed", {
        status: res.status,
        error: JSON.stringify(error),
        duration: Date.now() - start,
      });
      await log.flush();
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    log.info("Logs fetched", {
      entryCount: data.entries?.length,
      source: params.get("source") ?? undefined,
      duration: Date.now() - start,
    });
    await log.flush();
    return NextResponse.json(data);
  } catch (error) {
    log.error("File server connection failed", {
      error: String(error),
      duration: Date.now() - start,
    });
    await log.flush();
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 502 }
    );
  }
}
