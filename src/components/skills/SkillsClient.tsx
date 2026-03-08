"use client";

import { useState, useCallback, useEffect } from "react";
import { Save, RefreshCw, RotateCcw, AlertCircle, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/config/CodeEditor";
import { SkillTree } from "./SkillTree";
import { readFile, writeFile } from "@/lib/file-api";
import type { SkillInfo } from "./types";

export function SkillsClient() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isBuiltinFile, setIsBuiltinFile] = useState(false);
  const [originalContent, setOriginalContent] = useState("");
  const [content, setContent] = useState("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverModifiedAt, setServerModifiedAt] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  const hasChanges = content !== originalContent;
  const filename = selectedPath?.split("/").pop() || "";

  // Fetch skills list
  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Failed to fetch skills");
      const data = await res.json();
      setSkills(data.skills ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Load file content
  const loadFile = useCallback(async (path: string) => {
    setIsLoadingFile(true);
    setFileError(null);
    try {
      const data = await readFile(path);
      setOriginalContent(data.content);
      setContent(data.content);
      setSelectedPath(path);
      setServerModifiedAt(data.modifiedAt);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  // Handle file selection from tree
  const handleSelectFile = useCallback(
    (path: string, isBuiltin: boolean) => {
      if (hasChanges) {
        if (!confirm("You have unsaved changes. Discard them?")) return;
      }
      setIsBuiltinFile(isBuiltin);
      loadFile(path);
    },
    [hasChanges, loadFile]
  );

  // Reload file
  const reloadFile = useCallback(async () => {
    if (!selectedPath) return;
    if (hasChanges) {
      setIsReloading(true);
      try {
        const data = await readFile(selectedPath);
        const serverChanged = serverModifiedAt && data.modifiedAt !== serverModifiedAt;
        const msg = serverChanged
          ? "⚠️ Conflict detected!\n\nYou have unsaved local changes, and the file has also been modified on the server.\n\nClick OK to discard your local changes and load the server version.\nClick Cancel to keep your local changes."
          : "You have unsaved changes.\n\nClick OK to discard them and reload.\nClick Cancel to keep editing.";
        if (!confirm(msg)) {
          setIsReloading(false);
          return;
        }
        setOriginalContent(data.content);
        setContent(data.content);
        setServerModifiedAt(data.modifiedAt);
        setFileError(null);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to reload file");
      } finally {
        setIsReloading(false);
      }
    } else {
      loadFile(selectedPath);
    }
  }, [selectedPath, hasChanges, serverModifiedAt, loadFile]);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedPath || !hasChanges || isBuiltinFile) return;
    setIsSaving(true);
    setFileError(null);
    try {
      await writeFile(selectedPath, content);
      setOriginalContent(content);
      const data = await readFile(selectedPath);
      setServerModifiedAt(data.modifiedAt);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [selectedPath, content, hasChanges, isBuiltinFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (selectedPath && hasChanges && !isBuiltinFile) saveFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        e.stopPropagation();
        reloadFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [saveFile, reloadFile, selectedPath, hasChanges, isBuiltinFile]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-zinc-400">{error}</p>
        <Button onClick={fetchSkills}>Retry</Button>
      </div>
    );
  }

  const customCount = skills.filter((s) => s.source === "custom").length;
  const builtinCount = skills.filter((s) => s.source === "builtin").length;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950">
        <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Skills</h2>
          <span className="text-xs text-zinc-600 ml-auto">{skills.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <SkillTree
            skills={skills}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2 min-w-0">
            {selectedPath ? (
              <>
                {isBuiltinFile && (
                  <Lock className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                )}
                <span className="text-sm text-zinc-400 truncate">
                  {selectedPath}
                </span>
                {hasChanges && !isBuiltinFile && (
                  <span className="text-xs text-amber-500 flex-shrink-0">(unsaved)</span>
                )}
                {isBuiltinFile && (
                  <span className="text-xs text-zinc-600 flex-shrink-0">(read-only)</span>
                )}
              </>
            ) : (
              <span className="text-sm text-zinc-500">Select a skill to browse</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && <span className="text-xs text-green-500">Saved!</span>}
            {fileError && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fileError}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={reloadFile}
              disabled={!selectedPath || isReloading}
              className="h-8"
              title="Reload file (⌘R)"
            >
              {isReloading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span className="ml-1">Reload</span>
              <span className="ml-1 text-xs text-zinc-500">⌘R</span>
            </Button>
            {!isBuiltinFile && (
              <Button
                size="sm"
                variant="outline"
                onClick={saveFile}
                disabled={!hasChanges || isSaving}
                className="h-8"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-1">Save</span>
                <span className="ml-1 text-xs text-zinc-500">⌘S</span>
              </Button>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          {isLoadingFile ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-6 w-6 text-zinc-500 animate-spin" />
            </div>
          ) : selectedPath ? (
            <CodeEditor
              value={content}
              filename={filename}
              onChange={setContent}
              onSave={saveFile}
              readOnly={isBuiltinFile}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <div className="text-6xl mb-4">✨</div>
              <p className="text-lg">Select a skill from the sidebar</p>
              <p className="text-sm mt-2 text-zinc-600">
                {customCount} custom · {builtinCount} built-in skills
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
