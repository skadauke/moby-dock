/**
 * File API client for communicating with the Moby Dock file server
 * Uses server-side API routes to keep tokens secure
 */

// Home directory - configured via env or defaults to /Users/skadauke
const HOME = process.env.NEXT_PUBLIC_HOME_DIR || '';

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
  const res = await fetch(endpoint, {
    ...options,
    headers: {
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
  const data = await fetchApi<ListResponse>(`/api/files/list?dir=${encodeURIComponent(dirPath)}`);
  return data.files.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(filePath: string): Promise<FileContent> {
  return fetchApi<FileContent>(`/api/files?path=${encodeURIComponent(filePath)}`);
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fetchApi('/api/files', {
    method: 'POST',
    body: JSON.stringify({ path: filePath, content }),
  });
}

export async function deleteFile(filePath: string): Promise<void> {
  await fetchApi(`/api/files?path=${encodeURIComponent(filePath)}`, {
    method: 'DELETE',
  });
}

// Agent info from /api/agents
export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  emoji?: string;
  isDefault: boolean;
}

// Workspace files that agents typically have
const WORKSPACE_FILES = ['SOUL.md', 'AGENTS.md', 'MEMORY.md', 'HEARTBEAT.md', 'TOOLS.md', 'IDENTITY.md', 'USER.md'];

// Dynamic base paths from agent list
export function getBasePaths(agents: AgentInfo[]): { name: string; path: string; description: string }[] {
  const paths = agents.map(a => ({
    name: `${a.emoji || '📁'} ${a.name}`,
    path: a.workspace,
    description: a.workspace.replace(HOME, '~'),
  }));
  paths.push({ name: 'OpenClaw', path: `${HOME}/.openclaw`, description: '~/.openclaw' });
  return paths;
}

// Dynamic quick access files grouped by agent
export interface QuickAccessGroup {
  agent: string;
  emoji?: string;
  files: { name: string; path: string; description: string }[];
}

export function getQuickAccessFiles(agents: AgentInfo[]): QuickAccessGroup[] {
  const groups: QuickAccessGroup[] = agents.map(a => ({
    agent: a.name,
    emoji: a.emoji,
    files: WORKSPACE_FILES.map(f => ({
      name: f,
      path: `${a.workspace}/${f}`,
      description: f.replace('.md', ''),
    })),
  }));
  // Add shared OpenClaw group
  groups.push({
    agent: 'OpenClaw',
    emoji: undefined,
    files: [
      { name: 'openclaw.json', path: `${HOME}/.openclaw/openclaw.json`, description: 'Gateway config' },
    ],
  });
  return groups;
}

// Legacy hardcoded exports (fallback when agent discovery fails)
export const QUICK_ACCESS_FILES = [
  { name: 'SOUL.md', path: `${HOME}/clawd/SOUL.md`, description: 'Personality & persona' },
  { name: 'AGENTS.md', path: `${HOME}/clawd/AGENTS.md`, description: 'Workspace rules' },
  { name: 'HEARTBEAT.md', path: `${HOME}/clawd/HEARTBEAT.md`, description: 'Periodic checks' },
  { name: 'TOOLS.md', path: `${HOME}/clawd/TOOLS.md`, description: 'Tool settings' },
  { name: 'USER.md', path: `${HOME}/clawd/USER.md`, description: 'User info' },
  { name: 'IDENTITY.md', path: `${HOME}/clawd/IDENTITY.md`, description: 'Name & avatar' },
  { name: 'MEMORY.md', path: `${HOME}/clawd/MEMORY.md`, description: 'Long-term memory' },
  { name: 'openclaw.json', path: `${HOME}/.openclaw/openclaw.json`, description: 'Gateway config' },
];

// Legacy hardcoded base paths (fallback when agent discovery fails)
export const BASE_PATHS = [
  { name: 'Workspace', path: `${HOME}/clawd`, description: '~/clawd' },
  { name: 'OpenClaw', path: `${HOME}/.openclaw`, description: '~/.openclaw' },
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
