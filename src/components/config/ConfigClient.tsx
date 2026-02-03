"use client";

import { useState, useCallback, useEffect } from "react";
import { Save, RefreshCw, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { QuickAccess } from "./QuickAccess";
import { SearchPanel } from "./SearchPanel";
import { readFile, writeFile, BASE_PATHS } from "@/lib/file-api";

export function ConfigClient() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [serverModifiedAt, setServerModifiedAt] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  const hasChanges = content !== originalContent;
  const filename = selectedPath?.split("/").pop() || "";
  const isOpenClawConfig = filename === "openclaw.json";

  // Load file content
  const loadFile = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await readFile(path);
      setOriginalContent(data.content);
      setContent(data.content);
      setSelectedPath(path);
      setServerModifiedAt(data.modifiedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload file from server
  const reloadFile = useCallback(async () => {
    if (!selectedPath) return;
    
    // Check for unsaved changes
    if (hasChanges) {
      // Fetch server version to check for conflicts
      setIsReloading(true);
      try {
        const data = await readFile(selectedPath);
        const serverChanged = serverModifiedAt && data.modifiedAt !== serverModifiedAt;
        
        if (serverChanged) {
          // Both local and server have changes - conflict!
          const choice = confirm(
            "⚠️ Conflict detected!\n\n" +
            "You have unsaved local changes, and the file has also been modified on the server.\n\n" +
            "Click OK to discard your local changes and load the server version.\n" +
            "Click Cancel to keep your local changes."
          );
          if (!choice) {
            setIsReloading(false);
            return;
          }
        } else {
          // Only local changes
          const choice = confirm(
            "You have unsaved changes.\n\n" +
            "Click OK to discard them and reload.\n" +
            "Click Cancel to keep editing."
          );
          if (!choice) {
            setIsReloading(false);
            return;
          }
        }
        
        // Apply server version
        setOriginalContent(data.content);
        setContent(data.content);
        setServerModifiedAt(data.modifiedAt);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reload file");
      } finally {
        setIsReloading(false);
      }
    } else {
      // No local changes - just reload
      loadFile(selectedPath);
    }
  }, [selectedPath, hasChanges, serverModifiedAt, loadFile]);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedPath || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      await writeFile(selectedPath, content);
      setOriginalContent(content);
      // Update serverModifiedAt to prevent false conflict detection
      const data = await readFile(selectedPath);
      setServerModifiedAt(data.modifiedAt);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [selectedPath, content, hasChanges]);

  // Restart OpenClaw Gateway
  const restartGateway = useCallback(async () => {
    setIsRestarting(true);
    setError(null);
    try {
      // Call the OpenClaw gateway restart endpoint
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
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault(); // Override browser refresh
        reloadFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile, reloadFile]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950">
        <div className="p-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300">Files</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Search */}
          <SearchPanel onSelectResult={handleSelectFile} />

          {/* Quick Access - drag files here from Browse to add */}
          <QuickAccess
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
              baseDescription={base.description}
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
            {isOpenClawConfig && (
              <Button
                size="sm"
                variant="outline"
                onClick={restartGateway}
                disabled={isRestarting || hasChanges}
                className="h-8"
                title={hasChanges ? "Save changes first" : "Restart OpenClaw Gateway"}
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
              variant="ghost"
              onClick={reloadFile}
              disabled={!selectedPath || isReloading}
              className="h-8"
              title="Reload file from server (⌘R)"
            >
              {isReloading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span className="ml-1">Reload</span>
              <span className="ml-1 text-xs text-zinc-500">⌘R</span>
            </Button>
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
