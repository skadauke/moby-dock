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
  agents?: {
    list?: AgentConfig[];
  };
}

interface SessionFromServer {
  id: string;
  file: string;
  size: number;
  modifiedAt: string;
  startedAt?: string;
  meta: { key?: string; [k: string]: unknown };
}

async function getAgentList(): Promise<AgentConfig[]> {
  const res = await fetch(
    `${FILE_SERVER_URL}/files?path=${encodeURIComponent(`${HOME}/.openclaw/openclaw.json`)}`,
    {
      headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const config: OpenClawConfig = JSON.parse(data.content ?? "{}");
  return config.agents?.list ?? [];
}

export async function GET() {
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agents = await getAgentList();

    // If no agents configured, fall back to default behavior
    if (agents.length === 0) {
      const res = await fetch(`${FILE_SERVER_URL}/memory/sessions`, {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return NextResponse.json(
          { error: err.error || "Failed to list sessions" },
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
          const sessions: SessionFromServer[] = data.sessions || [];
          return sessions.map((s) => ({ ...s, agentId: agent.id }));
        } catch {
          return [];
        }
      })
    );

    const merged = allSessions.flat();

    return NextResponse.json({ sessions: merged });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 500 }
    );
  }
}
