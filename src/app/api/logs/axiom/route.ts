import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";

const AXIOM_TOKEN = process.env.AXIOM_TOKEN || process.env.NEXT_PUBLIC_AXIOM_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET || process.env.NEXT_PUBLIC_AXIOM_DATASET || "moby-dock.log";

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

  // Build query using legacy query API (APL has issues with nested "data.*" fields)
  interface AxiomFilter {
    field: string;
    op: string;
    value: string | string[];
  }
  const filters: AxiomFilter[] = [];
  if (levels && levels.length > 0) {
    filters.push({ field: "data.level", op: "==", value: levels.length === 1 ? levels[0] : levels });
  }
  if (search) {
    filters.push({ field: "data.message", op: "contains", value: search });
  }

  const queryBody: Record<string, unknown> = {
    startTime,
    endTime,
    limit: limit + 1,
  };
  if (filters.length > 0) {
    queryBody.filter = filters.length === 1
      ? { field: filters[0].field, op: filters[0].op, value: filters[0].value }
      : { op: "and", children: filters.map(f => ({ field: f.field, op: f.op, value: f.value })) };
  }

  const start = Date.now();
  try {
    const response = await fetch(
      `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AXIOM_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queryBody),
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
