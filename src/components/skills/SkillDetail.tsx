"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, Code, Save, Loader2, FolderOpen, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import Editor from "@monaco-editor/react";
import { readFile, writeFile, listDirectory, getLanguage } from "@/lib/file-api";
import type { SkillInfo, FileInfo } from "./types";

interface Props {
  skill: SkillInfo;
  onClose: () => void;
}

export function SkillDetail({ skill, onClose }: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [skillContent, setSkillContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Files tab state
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileLoading, setFileLoading] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, FileInfo[]>>(new Map());

  const isReadOnly = skill.source === "builtin";

  // Load SKILL.md content
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readFile(skill.path + "/SKILL.md")
      .then((data) => {
        if (!cancelled) {
          setSkillContent(data.content);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSkillContent("*Failed to load SKILL.md*");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [skill.path]);

  // Load files list when files tab is active
  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const fileList = await listDirectory(skill.path);
      setFiles(fileList);
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [skill.path]);

  useEffect(() => {
    if (activeTab === "files") {
      loadFiles();
    }
  }, [activeTab, loadFiles]);

  const toggleDir = async (dirPath: string) => {
    const next = new Set(expandedDirs);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
      if (!dirContents.has(dirPath)) {
        try {
          const contents = await listDirectory(dirPath);
          setDirContents((prev) => new Map(prev).set(dirPath, contents));
        } catch {
          // ignore
        }
      }
    }
    setExpandedDirs(next);
  };

  const openFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setFileLoading(true);
    setIsDirty(false);
    try {
      const data = await readFile(filePath);
      setFileContent(data.content);
      setEditedContent(data.content);
    } catch {
      setFileContent("// Failed to load file");
      setEditedContent("// Failed to load file");
    } finally {
      setFileLoading(false);
    }
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedFile || isReadOnly) return;
    setSaving(true);
    setSaveError(null);
    try {
      await writeFile(selectedFile, editedContent);
      setFileContent(editedContent);
      setIsDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Strip frontmatter for overview display
  const markdownBody = skillContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");

  const renderFileTree = (items: FileInfo[], depth = 0) => {
    return items.map((item) => (
      <div key={item.path}>
        <button
          onClick={() => (item.isDirectory ? toggleDir(item.path) : openFile(item.path))}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-800/50 rounded transition-colors ${
            selectedFile === item.path ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {item.isDirectory ? (
            <>
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                  expandedDirs.has(item.path) ? "rotate-90" : ""
                }`}
              />
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            </>
          ) : (
            <>
              <span className="w-3.5" />
              <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            </>
          )}
          <span className="truncate">{item.name}</span>
          {item.size !== undefined && !item.isDirectory && (
            <span className="ml-auto text-xs text-zinc-600">
              {item.size < 1024
                ? `${item.size}B`
                : `${(item.size / 1024).toFixed(1)}KB`}
            </span>
          )}
        </button>
        {item.isDirectory && expandedDirs.has(item.path) && dirContents.has(item.path) && (
          <div>{renderFileTree(dirContents.get(item.path)!, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const selectedFileName = selectedFile?.split("/").pop() || "";

  return (
    <div
      className={`fixed inset-y-0 right-0 w-full max-w-3xl bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col transition-transform duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{skill.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100 truncate">{skill.name}</h2>
              <Badge
                variant="secondary"
                className={`text-[10px] shrink-0 ${
                  skill.source === "custom"
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30"
                }`}
              >
                {skill.source === "custom" ? "Custom" : "Built-in"}
              </Badge>
              {isReadOnly && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                  <Lock className="h-2.5 w-2.5 mr-1" />
                  Read-only
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500 truncate">{skill.description}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-5 mt-3 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 text-xs">
            <Code className="h-3.5 w-3.5" />
            Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-auto px-5 py-4 m-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="prose prose-invert prose-zinc max-w-none prose-sm prose-headings:text-zinc-200 prose-p:text-zinc-400 prose-a:text-blue-400 prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
              <ReactMarkdown>{markdownBody}</ReactMarkdown>
            </div>
          )}

          {/* Metadata footer */}
          <div className="mt-6 pt-4 border-t border-zinc-800 space-y-2 text-xs text-zinc-500">
            <div className="flex items-center gap-4">
              <span>{skill.fileCount} files</span>
              {skill.lastModified && (
                <span>Modified {new Date(skill.lastModified).toLocaleDateString()}</span>
              )}
            </div>
            {skill.requires && skill.requires.length > 0 && (
              <div className="flex items-center gap-2">
                <span>Requires:</span>
                {skill.requires.map((bin) => (
                  <Badge key={bin} variant="secondary" className="text-[10px] bg-zinc-800 text-zinc-400">
                    {bin}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-zinc-600 font-mono text-[11px]">{skill.path}</div>
          </div>
        </TabsContent>

        <TabsContent value="files" className="flex-1 flex min-h-0 m-0">
          {/* File tree sidebar */}
          <div className="w-56 shrink-0 border-r border-zinc-800 overflow-auto py-2">
            {filesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : files.length === 0 ? (
              <p className="text-sm text-zinc-500 px-3 py-4">No files found</p>
            ) : (
              renderFileTree(files)
            )}
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFile ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
                  <span className="text-sm text-zinc-300 font-mono truncate">{selectedFileName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDirty && !isReadOnly && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Save
                      </Button>
                    )}
                    {saveError && (
                      <span className="text-xs text-red-400">{saveError}</span>
                    )}
                    {isReadOnly && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-400">
                        Read-only
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  {fileLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      language={getLanguage(selectedFileName)}
                      value={editedContent}
                      onChange={(value) => {
                        setEditedContent(value || "");
                        setIsDirty(value !== fileContent);
                      }}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        readOnly: isReadOnly,
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        padding: { top: 12 },
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2">
                <Code className="h-10 w-10" />
                <p className="text-sm">Select a file to view</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
