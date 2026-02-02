"use client";

import { useState, useCallback, useEffect } from "react";
import { Save, RefreshCw, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { QuickAccess } from "./QuickAccess";
import { readFile, writeFile, QUICK_ACCESS_FILES, BASE_PATHS } from "@/lib/file-api";

export function ConfigClient() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasChanges = content !== originalContent;
  const filename = selectedPath?.split("/").pop() || "";
  const isClawdbotConfig = filename === "clawdbot.json";

  // Load file content
  const loadFile = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await readFile(path);
      setOriginalContent(data.content);
      setContent(data.content);
      setSelectedPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedPath || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      await writeFile(selectedPath, content);
      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [selectedPath, content, hasChanges]);

  // Restart Clawdbot Gateway
  const restartGateway = useCallback(async () => {
    setIsRestarting(true);
    setError(null);
    try {
      // Call the Clawdbot gateway restart endpoint
      const res = await fetch("/api/gateway/restart", { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to restart gateway");
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart gateway");
    } finally {
      setIsRestarting(false);
    }
  }, []);

  // Handle file selection
  const handleSelectFile = useCallback((path: string) => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return;
      }
    }
    loadFile(path);
  }, [hasChanges, loadFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950">
        <div className="p-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300">Files</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Quick Access */}
          <QuickAccess
            items={QUICK_ACCESS_FILES}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />

          {/* File Trees */}
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2 mt-4">
            Browse
          </h3>
          {BASE_PATHS.map((base) => (
            <FileTree
              key={base.path}
              basePath={base.path}
              baseName={base.name}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
            />
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2 min-w-0">
            {selectedPath ? (
              <>
                <span className="text-sm text-zinc-400 truncate">
                  {selectedPath}
                </span>
                {hasChanges && (
                  <span className="text-xs text-amber-500 flex-shrink-0">
                    (unsaved)
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-zinc-500">
                Select a file to edit
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs text-green-500">Saved!</span>
            )}
            {error && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </span>
            )}
            {isClawdbotConfig && (
              <Button
                size="sm"
                variant="outline"
                onClick={restartGateway}
                disabled={isRestarting || hasChanges}
                className="h-8"
                title={hasChanges ? "Save changes first" : "Restart Clawdbot Gateway"}
              >
                {isRestarting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span className="ml-1">Restart Gateway</span>
              </Button>
            )}
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
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-6 w-6 text-zinc-500 animate-spin" />
            </div>
          ) : selectedPath ? (
            <CodeEditor
              value={content}
              filename={filename}
              onChange={setContent}
              onSave={saveFile}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-lg">Select a file from the sidebar</p>
              <p className="text-sm mt-2">
                Edit workspace configuration files
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
