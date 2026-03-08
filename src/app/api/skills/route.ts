/**
 * Skills API Route
 *
 * Lists skills from both custom (~/.openclaw/skills) and built-in (~/openclaw/skills) directories.
 * Parses SKILL.md YAML frontmatter for metadata.
 *
 * @module api/skills
 */

import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-auth";
import { Logger } from "next-axiom";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

const HOME = process.env.HOME_DIR || process.env.HOME;
if (!HOME) {
  throw new Error("HOME_DIR or HOME environment variable is required");
}
const CUSTOM_SKILLS_DIR = `${HOME}/.openclaw/skills`;
const BUILTIN_SKILLS_DIR = `${HOME}/openclaw/skills`;

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
}

interface SkillInfo {
  name: string;
  description: string;
  emoji: string;
  source: "custom" | "builtin";
  path: string;
  fileCount: number;
  lastModified: string | null;
  requires?: string[];
}

async function fileServerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FILE_SERVER_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Simple parser — handles the common fields without a full YAML library.
 */
function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
  emoji?: string;
  requires?: string[];
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: { name?: string; description?: string; emoji?: string; requires?: string[] } = {};

  // Extract simple top-level fields
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");

  // Extract emoji from metadata.openclaw.emoji
  const emojiMatch = yaml.match(/emoji:\s*["']?([^\n"']+)["']?/);
  if (emojiMatch) result.emoji = emojiMatch[1].trim();

  // Extract requires.bins
  const binsMatch = yaml.match(/bins:\s*\[([^\]]*)\]/);
  if (binsMatch) {
    result.requires = binsMatch[1]
      .split(",")
      .map((b) => b.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  return result;
}

async function listSkillsFromDir(
  dir: string,
  source: "custom" | "builtin"
): Promise<SkillInfo[]> {
  try {
    const data = await fileServerFetch<{ files: FileInfo[] }>(
      `/files/list?dir=${encodeURIComponent(dir)}`
    );

    const skills: SkillInfo[] = [];

    for (const entry of data.files) {
      if (!entry.isDirectory) continue;

      try {
        // Read SKILL.md
        const skillMd = await fileServerFetch<{ content: string; modifiedAt: string }>(
          `/files?path=${encodeURIComponent(entry.path + "/SKILL.md")}`
        );

        const frontmatter = parseFrontmatter(skillMd.content);

        // Count files in skill directory
        let fileCount = 0;
        try {
          const files = await fileServerFetch<{ files: FileInfo[]; count: number }>(
            `/files/list?dir=${encodeURIComponent(entry.path)}`
          );
          fileCount = files.count || files.files?.length || 0;
        } catch {
          fileCount = 1; // At least SKILL.md
        }

        skills.push({
          name: frontmatter.name || entry.name,
          description: frontmatter.description || "",
          emoji: frontmatter.emoji || "✨",
          source,
          path: entry.path,
          fileCount,
          lastModified: skillMd.modifiedAt || entry.modifiedAt || null,
          requires: frontmatter.requires,
        });
      } catch {
        // Skip directories without SKILL.md
      }
    }

    return skills;
  } catch {
    return [];
  }
}

export async function GET() {
  const log = new Logger({ source: "api/skills" });

  // Check authentication (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized skills list attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [customSkills, builtinSkills] = await Promise.all([
      listSkillsFromDir(CUSTOM_SKILLS_DIR, "custom"),
      listSkillsFromDir(BUILTIN_SKILLS_DIR, "builtin"),
    ]);

    const allSkills = [...customSkills, ...builtinSkills];

    log.info("Skills listed", {
      custom: customSkills.length,
      builtin: builtinSkills.length,
    });
    await log.flush();

    return NextResponse.json({ skills: allSkills });
  } catch (error) {
    log.error("Failed to list skills", {
      error: error instanceof Error ? error.message : String(error),
    });
    await log.flush();
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 });
  }
}
