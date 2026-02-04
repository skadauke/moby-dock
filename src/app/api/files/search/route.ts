/**
 * File Search API
 *
 * Search across all workspace files for a query string.
 *
 * @module api/files/search
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { homedir } from "os";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";
const HOME = process.env.HOME_DIR || homedir();

const BASE_PATHS = [`${HOME}/clawd`, `${HOME}/.openclaw`, `${HOME}/.config/moby`];

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface SearchResult {
  path: string;
  line: number;
  content: string;
}

/** Maximum file size to search (1MB) - prevents memory issues */
const MAX_FILE_SIZE = 1024 * 1024;

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${FILE_SERVER_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

async function listFilesRecursive(
  dirPath: string,
  maxDepth = 3,
  currentDepth = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  try {
    const data = await fetchApi<{ files: FileInfo[] }>(
      `/files/list?dir=${encodeURIComponent(dirPath)}`
    );
    const files: string[] = [];

    for (const file of data.files) {
      if (file.name.startsWith(".")) continue; // Skip hidden files

      if (file.isDirectory) {
        const subFiles = await listFilesRecursive(file.path, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else {
        // Only include searchable text files
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (["md", "json", "yaml", "yml", "ts", "tsx", "js", "jsx", "txt", "sh"].includes(ext || "")) {
          files.push(file.path);
        }
      }
    }

    return files;
  } catch {
    // Silently ignore inaccessible directories
    return [];
  }
}

async function searchInFile(filePath: string, query: string): Promise<SearchResult[]> {
  try {
    const data = await fetchApi<{ content: string; size?: number }>(`/files?path=${encodeURIComponent(filePath)}`);
    
    // Skip files that are too large (prevent memory issues)
    if (data.size && data.size > MAX_FILE_SIZE) {
      return [];
    }
    
    // Also check content length as fallback
    if (data.content.length > MAX_FILE_SIZE) {
      return [];
    }
    
    const lines = data.content.split("\n");
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(queryLower)) {
        results.push({
          path: filePath,
          line: index + 1,
          content: line.trim().slice(0, 200), // Truncate long lines
        });
      }
    });

    return results;
  } catch {
    return [];
  }
}

/**
 * GET /api/files/search?q=query
 * Search across all workspace files
 */
export async function GET(request: NextRequest) {
  const log = new Logger({ source: "api/files/search" });
  const query = request.nextUrl.searchParams.get("q");

  log.info("GET /api/files/search", { query });

  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized search attempt", { query });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!query || query.length < 2) {
    log.warn("Search query too short", { query });
    await log.flush();
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    // Get all searchable files
    const allFiles: string[] = [];
    for (const basePath of BASE_PATHS) {
      const files = await listFilesRecursive(basePath);
      allFiles.push(...files);
    }

    // Search in each file (limit to first 100 files for performance)
    const filesToSearch = allFiles.slice(0, 100);
    const allResults: SearchResult[] = [];

    for (const filePath of filesToSearch) {
      const results = await searchInFile(filePath, query);
      allResults.push(...results);

      // Limit total results
      if (allResults.length >= 50) break;
    }

    const duration = Date.now() - startTime;

    log.info("[FileServer] search complete", {
      query,
      totalFiles: allFiles.length,
      searchedFiles: filesToSearch.length,
      resultCount: allResults.length,
      duration,
    });
    await log.flush();

    return NextResponse.json({
      results: allResults.slice(0, 50),
      totalFiles: allFiles.length,
      searchedFiles: filesToSearch.length,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error("[FileServer] search failed", {
      query,
      error: err instanceof Error ? err.message : String(err),
      duration,
    });
    await log.flush();
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
