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

import matter from "gray-matter";

/**
 * Parse YAML frontmatter from SKILL.md content using gray-matter.
 */
function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
  emoji?: string;
  requires?: string[];
} {
  try {
    const { data } = matter(content);
    const result: { name?: string; description?: string; emoji?: string; requires?: string[] } = {};

    if (data.name) result.name = String(data.name);
    if (data.description) result.description = String(data.description);

    // Extract emoji from metadata.openclaw.emoji
    const emoji = data.metadata?.openclaw?.emoji;
    if (emoji) result.emoji = String(emoji);

    // Extract requires.bins (can be array or nested)
    const bins = data.metadata?.openclaw?.requires?.bins
      ?? data.metadata?.openclaw?.requires?.anyBins;
    if (Array.isArray(bins)) {
      result.requires = bins.map(String);
    }

    return result;
  } catch {
    return {};
  }
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
  } catch (err) {
    // Don't swallow file server errors — let caller handle them
    throw new Error(
      `Failed to list ${source} skills from ${dir}: ${err instanceof Error ? err.message : "Unknown error"}`
    );
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
    const results = await Promise.allSettled([
      listSkillsFromDir(CUSTOM_SKILLS_DIR, "custom"),
      listSkillsFromDir(BUILTIN_SKILLS_DIR, "builtin"),
    ]);

    const customSkills = results[0].status === "fulfilled" ? results[0].value : [];
    const builtinSkills = results[1].status === "fulfilled" ? results[1].value : [];
    const errors: string[] = [];

    if (results[0].status === "rejected") {
      log.error("Failed to list custom skills", { error: String(results[0].reason) });
      errors.push("custom");
    }
    if (results[1].status === "rejected") {
      log.error("Failed to list built-in skills", { error: String(results[1].reason) });
      errors.push("builtin");
    }

    // If both sources failed, return 500
    if (errors.length === 2) {
      await log.flush();
      return NextResponse.json(
        { error: "Failed to list skills from all sources" },
        { status: 500 }
      );
    }

    const allSkills = [...customSkills, ...builtinSkills];

    log.info("Skills listed", {
      custom: customSkills.length,
      builtin: builtinSkills.length,
      errors: errors.length > 0 ? errors : undefined,
    });
    await log.flush();

    return NextResponse.json({
      skills: allSkills,
      ...(errors.length > 0 && { warnings: errors.map((s) => `Failed to load ${s} skills`) }),
    });
  } catch (error) {
    log.error("Failed to list skills", {
      error: error instanceof Error ? error.message : String(error),
    });
    await log.flush();
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 });
  }
}
