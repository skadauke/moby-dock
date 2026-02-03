import { NextRequest, NextResponse } from "next/server";
import { homedir } from "os";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "https://files.skadauke.dev";
const FILE_SERVER_TOKEN = process.env.FILE_SERVER_TOKEN || "";
const HOME = process.env.HOME_DIR || homedir();

const BASE_PATHS = [
  `${HOME}/clawd`,
  `${HOME}/.openclaw`,
  `${HOME}/.config/moby`,
];

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

async function fetchApi<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${FILE_SERVER_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
    },
  });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

async function listFilesRecursive(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];
  
  try {
    const data = await fetchApi<{ files: FileInfo[] }>(`/files/list?dir=${encodeURIComponent(dirPath)}`);
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
  } catch (err) {
    console.error(`Failed to list ${dirPath}:`, err);
    return [];
  }
}

async function searchInFile(filePath: string, query: string): Promise<SearchResult[]> {
  try {
    const data = await fetchApi<{ content: string }>(`/files?path=${encodeURIComponent(filePath)}`);
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
  } catch (err) {
    return [];
  }
}

/**
 * GET /api/files/search?q=query
 * Search across all workspace files
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }
  
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
    
    return NextResponse.json({
      results: allResults.slice(0, 50),
      totalFiles: allFiles.length,
      searchedFiles: filesToSearch.length,
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
