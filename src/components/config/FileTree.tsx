"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, File, RefreshCw } from "lucide-react";
import { listDirectory } from "@/lib/file-api";
import { cn } from "@/lib/utils";

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
}

interface FileTreeProps {
  basePath: string;
  baseName: string;
  baseDescription?: string; // Shows underlying path in small gray text
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

interface TreeNodeProps {
  file: FileInfo;
  level: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

function TreeNode({ file, level, selectedPath, onSelectFile }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isSelected = selectedPath === file.path;

  const loadChildren = async () => {
    if (!file.isDirectory || children.length > 0) return;
    setIsLoading(true);
    try {
      const files = await listDirectory(file.path);
      setChildren(files);
    } catch (err) {
      console.error("Failed to load directory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (file.isDirectory) {
      setIsOpen(!isOpen);
      if (!isOpen) loadChildren();
    } else {
      onSelectFile(file.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1 px-2 py-1 text-sm text-left hover:bg-zinc-800 rounded transition-colors",
          isSelected && "bg-zinc-800 text-blue-400"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {file.isDirectory ? (
          <>
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 text-zinc-500 animate-spin" />
            ) : isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
            <Folder className="h-4 w-4 text-zinc-400" />
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <File className="h-4 w-4 text-zinc-500" />
          </>
        )}
        <span className="truncate">{file.name}</span>
      </button>
      {isOpen && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              file={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ basePath, baseName, baseDescription, selectedPath, onSelectFile }: FileTreeProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoot();
  }, [basePath]);

  const loadRoot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const files = await listDirectory(basePath);
      setFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 rounded"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500 flex-shrink-0" />
        )}
        <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0">
          <span className="truncate">{baseName}</span>
          {baseDescription && (
            <span className="text-[10px] text-zinc-500 font-normal truncate">{baseDescription}</span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="ml-2">
          {isLoading ? (
            <div className="px-4 py-2 text-xs text-zinc-500">Loading...</div>
          ) : error ? (
            <div className="px-4 py-2 text-xs text-red-400">{error}</div>
          ) : (
            files.map((file) => (
              <TreeNode
                key={file.path}
                file={file}
                level={1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
