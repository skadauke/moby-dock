"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Task, Project, Priority, Creator, PRIORITIES, CREATORS } from "@/types/kanban";
import { Markdown } from "@/components/ui/markdown";
import { formatDateTime } from "@/lib/date-utils";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onTaskUpdated: (task: Task) => void;
  onTaskCreated: (task: Task) => void;
  defaultCreator?: Creator;
  defaultProjectId?: string | null;
}

export function TaskModal({
  open,
  onClose,
  task,
  onTaskUpdated,
  onTaskCreated,
  defaultCreator = "MOBY",
  defaultProjectId = null,
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [creator, setCreator] = useState<Creator>("MOBY");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const isEditing = !!task;

  // Fetch projects when modal opens
  useEffect(() => {
    if (open) {
      fetch("/api/projects")
        .then(res => res.ok ? res.json() : [])
        .then(data => setProjects(data))
        .catch(() => setProjects([]));
    }
  }, [open]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority || "");
      setCreator(task.creator);
      setProjectId(task.projectId);
    } else {
      setTitle("");
      setDescription("");
      setPriority("");
      setCreator(defaultCreator);
      setProjectId(defaultProjectId);
    }
    setError(null);
    setIsEditingDescription(!task); // Start in edit mode for new tasks
  }, [task, open, defaultCreator, defaultProjectId]);

  const doSubmit = useCallback(async () => {
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && task) {
        // Update existing task via API
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            priority: priority || null,
            creator,
            projectId,
          }),
        });
        
        if (!res.ok) throw new Error("Failed to update task");
        
        const updated = await res.json();
        onTaskUpdated(updated);
      } else {
        // Create new task via API
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            priority: priority || undefined,
            creator,
            projectId: projectId || undefined,
          }),
        });
        
        if (!res.ok) throw new Error("Failed to create task");
        
        const created = await res.json();
        onTaskCreated(created);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save task";
      setError(message);
      console.error("Task save error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, description, priority, creator, projectId, isEditing, task, isSubmitting, onTaskUpdated, onTaskCreated, onClose]);

  // Keyboard shortcut: Cmd/Ctrl+Enter to submit
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        doSubmit();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, doSubmit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-950/50 px-3 py-2 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="bg-zinc-900 border-zinc-800"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Details</Label>
            {isEditingDescription ? (
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  // Only switch to preview if there's content and we're editing an existing task
                  if (description && isEditing) {
                    setIsEditingDescription(false);
                  }
                }}
                placeholder="Add context, links, notes... (Markdown supported)"
                className="bg-zinc-900 border-zinc-800 min-h-[100px]"
                disabled={isSubmitting}
                autoFocus={isEditing}
              />
            ) : description ? (
              <div
                onClick={() => !isSubmitting && setIsEditingDescription(true)}
                className="bg-zinc-900 border border-zinc-800 rounded-md p-3 min-h-[100px] cursor-text hover:border-zinc-700 transition-colors"
              >
                <Markdown className="text-sm">{description}</Markdown>
              </div>
            ) : (
              <div
                onClick={() => !isSubmitting && setIsEditingDescription(true)}
                className="bg-zinc-900 border border-zinc-800 rounded-md p-3 min-h-[100px] cursor-text hover:border-zinc-700 transition-colors text-zinc-500 text-sm"
              >
                Click to add details (Markdown supported)...
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={priority} 
                onValueChange={(v) => setPriority(v as Priority)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.color}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Creator</Label>
              <Select 
                value={creator} 
                onValueChange={(v) => setCreator(v as Creator)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {CREATORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        {c.emoji} {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project selector */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select 
              value={projectId || "none"} 
              onValueChange={(v) => setProjectId(v === "none" ? null : v)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="none">
                  <span className="text-zinc-400">No project</span>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timestamps - only show for existing tasks */}
          {isEditing && task && (
            <div className="text-xs text-zinc-500 flex gap-4 pt-2 border-t border-zinc-800">
              <span>Created: {formatDateTime(task.createdAt)}</span>
              <span>Updated: {formatDateTime(task.updatedAt)}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-zinc-700"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
