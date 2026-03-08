export interface SkillInfo {
  name: string;
  description: string;
  emoji: string;
  source: "custom" | "builtin";
  path: string;
  fileCount: number;
  lastModified: string | null;
  requires?: string[];
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
}
