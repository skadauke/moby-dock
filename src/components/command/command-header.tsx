"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskModal } from "./task-modal";
import { Task, Creator } from "@/types/kanban";
import { Plus, Flag, X, RefreshCw } from "lucide-react";

export type FilterType = "all" | "flagged" | "moby" | "stephan";

interface CommandHeaderProps {
  onTaskCreated: (task: Task) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  flaggedCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  selectedProjectId?: string | null;
}

export function CommandHeader({
  onTaskCreated,
  filter,
  onFilterChange,
  flaggedCount,
  onRefresh,
  isRefreshing,
  selectedProjectId,
}: CommandHeaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Default creator for new tasks (could be enhanced with session info later)
  const defaultCreator: Creator = "STEPHAN";

  // Open modal handler (also used by keyboard shortcut)
  const openNewTaskModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+N for new task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+N (Mac) or Ctrl+N (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault(); // Override browser's "New Window" behavior
        openNewTaskModal();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openNewTaskModal]);

  return (
    <>
      <header className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title */}
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-100">Command</h1>
            </div>

            {/* Center: Filters */}
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <Button
                variant={filter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => onFilterChange("all")}
                className={`h-7 px-2 ${filter === "all" ? "bg-zinc-700" : "text-zinc-400"}`}
              >
                All
              </Button>
              <Button
                variant={filter === "flagged" ? "default" : "ghost"}
                size="sm"
                onClick={() => onFilterChange("flagged")}
                className={`h-7 px-2 ${
                  filter === "flagged"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "text-zinc-400"
                }`}
              >
                <Flag className="h-3 w-3 mr-1" />
                Review
                {flaggedCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-amber-500/20 text-amber-300 text-xs px-1.5 h-4"
                  >
                    {flaggedCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant={filter === "moby" ? "default" : "ghost"}
                size="sm"
                onClick={() => onFilterChange("moby")}
                className={`h-7 px-2 ${filter === "moby" ? "bg-zinc-700" : "text-zinc-400"}`}
                title="Show Moby's tasks"
              >
                🐋
              </Button>
              <Button
                variant={filter === "stephan" ? "default" : "ghost"}
                size="sm"
                onClick={() => onFilterChange("stephan")}
                className={`h-7 px-2 ${filter === "stephan" ? "bg-zinc-700" : "text-zinc-400"}`}
                title="Show Stephan's tasks"
              >
                👤
              </Button>
              {filter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterChange("all")}
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-100"
                  title="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8 text-zinc-400"
                  title="Refresh tasks"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              )}
              <Button
                onClick={openNewTaskModal}
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700"
                title="New task (⌘N)"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </div>
        </div>
      </header>

      <TaskModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={null}
        onTaskUpdated={() => {}}
        onTaskCreated={(task) => {
          onTaskCreated(task);
          setIsModalOpen(false);
        }}
        defaultCreator={defaultCreator}
        defaultProjectId={selectedProjectId}
      />
    </>
  );
}
