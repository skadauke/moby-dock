import { homedir } from "node:os";
import path from "node:path";
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

interface SessionIndexEntry {
  sessionId: string;
  updatedAt: number;
  sessionFile?: string;
  displayName?: string;
  chatType?: string;
  channel?: string;
  subject?: string;
  groupId?: string;
  [k: string]: unknown;
}

interface SessionInfo {
  id: string;
  file: string;
  size: number;
  modifiedAt: string;
  startedAt?: string;
  agentId: string;
  sessionFile?: string;
  meta: {
    key: string;
    displayName?: string;
    subject?: string;
    channel?: string;
    chatType?: string;
  };
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

async function readSessionsIndex(agentId: string): Promise<Record<string, SessionIndexEntry>> {
  const sessionsJsonPath = `${HOME}/.openclaw/agents/${agentId}/sessions/sessions.json`;
  const res = await fetch(
    `${FILE_SERVER_URL}/files?path=${encodeURIComponent(sessionsJsonPath)}`,
    {
      headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) return {};
  const data = await res.json();
  try {
    return JSON.parse(data.content ?? "{}");
  } catch {
    return {};
  }
}

export async function GET() {
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agents = await getAgentList();

    // If no agents configured, use a default "main" agent
    const agentIds = agents.length > 0
      ? agents.map((a) => a.id)
      : ["main"];

    // Read sessions.json for all agents in parallel
    const allSessions = await Promise.all(
      agentIds.map(async (agentId) => {
        try {
          const index = await readSessionsIndex(agentId);
          const sessions: SessionInfo[] = [];

          for (const [key, entry] of Object.entries(index)) {
            // Filter out ephemeral sessions without a session file
            if (!entry.sessionFile) continue;

            const modifiedAt = new Date(entry.updatedAt).toISOString();

            sessions.push({
              id: entry.sessionId,
              file: path.basename(entry.sessionFile),
              size: 0,
              modifiedAt,
              startedAt: modifiedAt,
              agentId,
              sessionFile: entry.sessionFile,
              meta: {
                key,
                displayName: entry.displayName,
                subject: entry.subject,
                channel: entry.channel,
                chatType: entry.chatType,
              },
            });
          }

          return sessions;
        } catch {
          return [];
        }
      })
    );

    // Merge and sort by updatedAt descending
    const sessions = allSessions
      .flat()
      .sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );

    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to file server" },
      { status: 500 }
    );
  }
}
