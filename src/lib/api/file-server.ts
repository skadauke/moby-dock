import type {
  FileContent,
  FileListResponse,
  FileWriteRequest,
  FileWriteResponse,
  HealthResponse,
} from '@/types/files';

const FILE_SERVER_URL = process.env.NEXT_PUBLIC_FILE_SERVER_URL || 'https://files.skadauke.dev';

class FileServerClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${FILE_SERVER_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async health(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>('/health');
  }

  async readFile(path: string): Promise<FileContent> {
    return this.fetch<FileContent>(`/files?path=${encodeURIComponent(path)}`);
  }

  async writeFile(path: string, content: string): Promise<FileWriteResponse> {
    return this.fetch<FileWriteResponse>('/files', {
      method: 'POST',
      body: JSON.stringify({ path, content } as FileWriteRequest),
    });
  }

  async listDirectory(dir: string): Promise<FileListResponse> {
    return this.fetch<FileListResponse>(`/files/list?dir=${encodeURIComponent(dir)}`);
  }

  async deleteFile(path: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(`/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
  }
}

export const fileServer = new FileServerClient();
