export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
}

export interface FileContent {
  content: string;
  modifiedAt: string;
  size: number;
}

export interface FileListResponse {
  files: FileInfo[];
  count: number;
}

export interface FileWriteRequest {
  path: string;
  content: string;
}

export interface FileWriteResponse {
  success: boolean;
  size: number;
  modifiedAt: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
}
