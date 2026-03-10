import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const AXIOM_TOKEN = process.env.AXIOM_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET || "moby-dock.log";

interface AxiomMatch {
  _time: string;
  data?: {
    level?: string;
    source?: string;
    message?: string;
    fields?: Record<string, unknown>;
    vercel?: Record<string, unknown>;
  };
}

function normalizeAxiomEntry(match: AxiomMatch) {
  const data = match.data || {};
  const fields = data.fields || {};
  const vercel = data.vercel || {};
  return {
    time: match._time,
    level: data.level || "info",
    source: "moby-dock",
    category: data.source || (vercel as Record<string, unknown>).source || "app",
    message: data.message || JSON.stringify(fields),
    data: {
      ...fields,
      ...(Object.keys(vercel).length > 0 ? { vercel } : {}),
    },
  };
}

export async function GET(req: NextRequest) {
  const log = new Logger({ source: "api/logs/axiom" });

  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized Axiom logs access");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!AXIOM_TOKEN) {
    log.error("AXIOM_TOKEN not configured");
    await log.flush();
    return NextResponse.json(
      { error: "Axiom not configured" },
      { status: 503 }
    );
  }

  const params = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "100"), 1), 500);
  const levels = params.get("level")?.split(",").map((l) => l.trim().toLowerCase());
  const search = params.get("search");
  const before = params.get("before");
  const after = params.get("after");

  // Default to last 1 hour if no time range specified
  const startTime = after || new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const endTime = before || new Date().toISOString();

  // Build APL query
  let apl = `['${AXIOM_DATASET}']`;
  if (levels && levels.length > 0) {
    const levelFilter = levels.map((l) => `data.level == "${l}"`).join(" or ");
    apl += ` | where ${levelFilter}`;
  }
  if (search) {
    const escaped = search.replace(/"/g, '\\"');
    apl += ` | where data.message contains "${escaped}"`;
  }
  apl += ` | sort by _time desc | take ${limit + 1}`;

  const start = Date.now();
  try {
    const response = await fetch(
      "https://api.axiom.co/v1/datasets/_apl?format=legacy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AXIOM_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apl, startTime, endTime }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();
      log.error("Axiom API error", {
        status: response.status,
        error: text.slice(0, 200),
        duration: Date.now() - start,
      });
      await log.flush();
      return NextResponse.json(
        { error: "Axiom query failed" },
        { status: 502 }
      );
    }

    const result = await response.json();
    const matches: AxiomMatch[] = result.matches || [];
    const hasMore = matches.length > limit;
    const entries = matches.slice(0, limit).map(normalizeAxiomEntry);

    log.info("Axiom logs fetched", {
      entryCount: entries.length,
      hasMore,
      duration: Date.now() - start,
    });
    await log.flush();

    return NextResponse.json({ entries, hasMore });
  } catch (error) {
    log.error("Axiom connection failed", {
      error: String(error),
      duration: Date.now() - start,
    });
    await log.flush();
    return NextResponse.json(
      { error: "Failed to connect to Axiom" },
      { status: 502 }
    );
  }
}
