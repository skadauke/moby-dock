import { homedir } from "node:os";
import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-auth";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";
const HOME = process.env.HOME_DIR || process.env.HOME || homedir();

interface AgentConfig {
  id: string;
  name: string;
  default?: boolean;
  workspace: string;
}

interface OpenClawConfig {
  agents?: { list?: AgentConfig[] };
}

async function readFileFromServer(filePath: string): Promise<string | null> {
  const res = await fetch(
    `${FILE_SERVER_URL}/files?path=${encodeURIComponent(filePath)}`,
    {
      headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`File server returned ${res.status}`);
  const data = await res.json();
  return data.content ?? null;
}

async function getAgentList(): Promise<AgentConfig[]> {
  const content = await readFileFromServer(`${HOME}/.openclaw/openclaw.json`);
  if (!content) return [];
  const config: OpenClawConfig = JSON.parse(content);
  return config.agents?.list ?? [];
}

export async function GET() {
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agents = await getAgentList();

    if (agents.length === 0) {
      // Fallback: no agent config, use default
      const res = await fetch(`${FILE_SERVER_URL}/memory/sessions`, {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return NextResponse.json(
          { error: err.error || "Failed" },
          { status: res.status }
        );
      }
      return NextResponse.json(await res.json());
    }

    // Fetch sessions from all agents in parallel
    const allSessions = await Promise.all(
      agents.map(async (agent) => {
        try {
          const res = await fetch(
            `${FILE_SERVER_URL}/memory/sessions?agent=${encodeURIComponent(agent.id)}`,
            {
              headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!res.ok) return [];
          const data = await res.json();
          const sessions = data.sessions || [];
          return sessions.map((s: Record<string, unknown>) => ({
            ...s,
            agentId: agent.id,
          }));
        } catch {
          return [];
        }
      })
    );

    const merged = allSessions.flat();

    // Deduplicate by session id
    const deduped = new Map<string, (typeof merged)[0]>();
    for (const s of merged) {
      const existing = deduped.get(s.id as string);
      if (!existing) {
        deduped.set(s.id as string, s);
      } else {
        const meta = s.meta as Record<string, unknown> | undefined;
        const key = typeof meta?.key === "string" ? meta.key : "";
        if (key.startsWith(`agent:${s.agentId}:`)) {
          deduped.set(s.id as string, s);
        }
      }
    }

    return NextResponse.json({ sessions: Array.from(deduped.values()) });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect" },
      { status: 500 }
    );
  }
}
