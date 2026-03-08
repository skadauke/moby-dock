"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  RefreshCw,
} from "lucide-react";
import { listDirectory } from "@/lib/file-api";
import type { SkillInfo } from "./types";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface SkillTreeProps {
  skills: SkillInfo[];
  selectedPath: string | null;
  onSelectFile: (path: string, isBuiltin: boolean) => void;
}

interface SkillFolderProps {
  skill: SkillInfo;
  isExpanded: boolean;
  selectedPath: string | null;
  onToggle: () => void;
  onSelectFile: (path: string, isBuiltin: boolean) => void;
}

interface DirectoryNodeProps {
  node: FileNode;
  selectedPath: string | null;
  isBuiltin: boolean;
  depth: number;
  onSelectFile: (path: string, isBuiltin: boolean) => void;
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return null; // handled by folder state
  if (name.endsWith(".md")) return <FileText className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />;
  if (name.endsWith(".sh") || name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".mjs"))
    return <FileCode className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />;
  return <FileText className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />;
}

function DirectoryNode({ node, selectedPath, isBuiltin, depth, onSelectFile }: DirectoryNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (!isExpanded && children.length === 0) {
      setLoading(true);
      setError(null);
      try {
        const files = await listDirectory(node.path);
        setChildren(files);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded((v) => !v);
  }, [isExpanded, children.length, node.path]);

  return (
    <>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/50 rounded transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-zinc-600 ml-auto" />}
      </button>
      {isExpanded && error && (
        <div className="px-4 py-1 text-xs text-red-400" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>{error}</div>
      )}
      {isExpanded &&
        children.map((child) =>
          child.isDirectory ? (
            <DirectoryNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              isBuiltin={isBuiltin}
              depth={depth + 1}
              onSelectFile={onSelectFile}
            />
          ) : (
            <button
              key={child.path}
              onClick={() => onSelectFile(child.path, isBuiltin)}
              className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                selectedPath === child.path
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-zinc-400 hover:bg-zinc-800/50"
              }`}
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              {getFileIcon(child.name, false)}
              <span className="truncate">{child.name}</span>
            </button>
          )
        )}
    </>
  );
}

function SkillFolder({ skill, isExpanded, selectedPath, onToggle, onSelectFile }: SkillFolderProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isBuiltin = skill.source === "builtin";

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExpanded || loaded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const f = await listDirectory(skill.path);
        if (!cancelled) {
          setFiles(f);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isExpanded, loaded, skill.path]);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-zinc-800/50 rounded transition-colors group"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        )}
        <span className="flex-shrink-0">{skill.emoji}</span>
        <span className="truncate text-zinc-300">{skill.name}</span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-zinc-600 ml-auto" />}
      </button>
      {isExpanded && error && (
        <div className="px-4 py-1 text-xs text-red-400">{error}</div>
      )}
      {isExpanded && loaded && (
        <div>
          {files.map((file) =>
            file.isDirectory ? (
              <DirectoryNode
                key={file.path}
                node={file}
                selectedPath={selectedPath}
                isBuiltin={isBuiltin}
                depth={2}
                onSelectFile={onSelectFile}
              />
            ) : (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path, isBuiltin)}
                className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                  selectedPath === file.path
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-zinc-400 hover:bg-zinc-800/50"
                }`}
                style={{ paddingLeft: "32px" }}
              >
                {getFileIcon(file.name, false)}
                <span className="truncate">{file.name}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function SkillTree({ skills, selectedPath, onSelectFile }: SkillTreeProps) {
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [customCollapsed, setCustomCollapsed] = useState(false);
  const [builtinCollapsed, setBuiltinCollapsed] = useState(true);

  const customSkills = skills.filter((s) => s.source === "custom");
  const builtinSkills = skills.filter((s) => s.source === "builtin");

  const toggleSkill = useCallback(
    (path: string, skill: SkillInfo) => {
      setExpandedSkills((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          // Auto-select SKILL.md when expanding
          onSelectFile(skill.path + "/SKILL.md", skill.source === "builtin");
        }
        return next;
      });
    },
    [onSelectFile]
  );

  const renderSection = (
    title: string,
    sectionSkills: SkillInfo[],
    collapsed: boolean,
    setCollapsed: (v: boolean) => void
  ) => {
    if (sectionSkills.length === 0) return null;
    return (
      <div className="mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {title}
          <span className="text-zinc-600 font-normal normal-case ml-auto">
            {sectionSkills.length}
          </span>
        </button>
        {!collapsed && (
          <div className="space-y-px">
            {sectionSkills.map((skill) => (
              <SkillFolder
                key={skill.path}
                skill={skill}
                isExpanded={expandedSkills.has(skill.path)}
                selectedPath={selectedPath}
                onToggle={() => toggleSkill(skill.path, skill)}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {renderSection("Custom", customSkills, customCollapsed, setCustomCollapsed)}
      {renderSection("Built-in", builtinSkills, builtinCollapsed, setBuiltinCollapsed)}
    </div>
  );
}
