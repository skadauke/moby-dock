/**
 * File API client for communicating with the Moby Dock file server
 */

const FILE_SERVER_URL = process.env.NEXT_PUBLIC_FILE_SERVER_URL || 'https://files.skadauke.dev';
const FILE_SERVER_TOKEN = process.env.NEXT_PUBLIC_FILE_SERVER_TOKEN || '';

// Home directory - configured via env or defaults to /Users/skadauke
const HOME = process.env.NEXT_PUBLIC_HOME_DIR || '/Users/skadauke';

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
}

interface FileContent {
  content: string;
  modifiedAt: string;
  size: number;
}

interface ListResponse {
  files: FileInfo[];
  count: number;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${FILE_SERVER_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export async function listDirectory(dirPath: string): Promise<FileInfo[]> {
  const data = await fetchApi<ListResponse>(`/files/list?dir=${encodeURIComponent(dirPath)}`);
  return data.files.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(filePath: string): Promise<FileContent> {
  return fetchApi<FileContent>(`/files?path=${encodeURIComponent(filePath)}`);
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fetchApi('/files', {
    method: 'POST',
    body: JSON.stringify({ path: filePath, content }),
  });
}

export async function deleteFile(filePath: string): Promise<void> {
  await fetchApi(`/files?path=${encodeURIComponent(filePath)}`, {
    method: 'DELETE',
  });
}

// Quick access files
export const QUICK_ACCESS_FILES = [
  { name: 'SOUL.md', path: `${HOME}/clawd/SOUL.md`, description: 'Personality & persona' },
  { name: 'AGENTS.md', path: `${HOME}/clawd/AGENTS.md`, description: 'Workspace rules' },
  { name: 'HEARTBEAT.md', path: `${HOME}/clawd/HEARTBEAT.md`, description: 'Periodic checks' },
  { name: 'TOOLS.md', path: `${HOME}/clawd/TOOLS.md`, description: 'Tool settings' },
  { name: 'USER.md', path: `${HOME}/clawd/USER.md`, description: 'User info' },
  { name: 'IDENTITY.md', path: `${HOME}/clawd/IDENTITY.md`, description: 'Name & avatar' },
  { name: 'MEMORY.md', path: `${HOME}/clawd/MEMORY.md`, description: 'Long-term memory' },
  { name: 'clawdbot.json', path: `${HOME}/.clawdbot/clawdbot.json`, description: 'Gateway config' },
];

// Base paths for file tree
export const BASE_PATHS = [
  { name: 'Workspace', path: `${HOME}/clawd` },
  { name: 'Clawdbot', path: `${HOME}/.clawdbot` },
  { name: 'Config', path: `${HOME}/.config/moby` },
];

// Get language for Monaco based on file extension
export function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': return 'markdown';
    case 'json': return 'json';
    case 'yaml':
    case 'yml': return 'yaml';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'js':
    case 'jsx': return 'javascript';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'sh':
    case 'bash': return 'shell';
    default: return 'plaintext';
  }
}
