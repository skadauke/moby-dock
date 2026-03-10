import { homedir } from "node:os";
import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
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
  model?: string;
}

interface OpenClawConfig {
  agents?: {
    list?: AgentConfig[];
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  emoji?: string;
  isDefault: boolean;
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
  if (!res.ok) {
    throw new Error(`File server returned ${res.status} for ${filePath}`);
  }

  const data = await res.json();
  return data.content ?? null;
}

function parseEmoji(identityContent: string): string | undefined {
  // Match **Emoji:** 🐙 or **Emoji:** `🐙` patterns
  const match = identityContent.match(/\*\*Emoji:\*\*\s*`?([^\s`]+)`?/);
  return match?.[1] || undefined;
}

export async function GET() {
  const log = new Logger({ source: "api/agents" });
  const { authenticated } = await checkApiAuth();
  if (!authenticated) {
    log.warn("Unauthorized agents list attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("GET /api/agents");

  try {
    const startTime = Date.now();
    const configContent = await readFileFromServer(
      `${HOME}/.openclaw/openclaw.json`
    );
    if (!configContent) {
      log.error("Failed to read openclaw.json");
      await log.flush();
      return NextResponse.json(
        { error: "Failed to read openclaw.json" },
        { status: 500 }
      );
    }

    const config: OpenClawConfig = JSON.parse(configContent);
    const agentList = config.agents?.list ?? [];

    if (agentList.length === 0) {
      log.info("No agents configured");
      await log.flush();
      return NextResponse.json({ agents: [] });
    }

    // Fetch IDENTITY.md for all agents in parallel
    const agents: AgentInfo[] = await Promise.all(
      agentList.map(async (agent) => {
        const identityContent = await readFileFromServer(
          `${agent.workspace}/IDENTITY.md`
        );
        const emoji = identityContent
          ? parseEmoji(identityContent)
          : undefined;

        return {
          id: agent.id,
          name: agent.name,
          workspace: agent.workspace,
          emoji,
          isDefault: agent.default === true,
        };
      })
    );

    const duration = Date.now() - startTime;
    log.info("GET /api/agents success", { count: agents.length, duration });
    await log.flush();
    return NextResponse.json({ agents });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    log.error("Failed to discover agents", { error: message });
    await log.flush();
    return NextResponse.json(
      { error: `Failed to discover agents: ${message}` },
      { status: 500 }
    );
  }
}
