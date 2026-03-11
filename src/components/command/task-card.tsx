'use client';

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, PRIORITIES, CREATORS } from "@/types/kanban";
import { useKanbanDnd } from "./kanban-dnd-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Flag, Trash2, Pencil } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onToggleFlag?: (taskId: string) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleFlag }: TaskCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const { activeOverTaskId, isDraggingTask } = useKanbanDnd();
  const isDropTarget = isDraggingTask && !isDragging && activeOverTaskId === task.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = PRIORITIES.find((p) => p.value === task.priority);
  const creator = CREATORS.find((c) => c.value === task.creator);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete?.(task.id);
    setShowDeleteConfirm(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on dropdown or dragging
    const target = e.target as HTMLElement;
    if (target.closest('[data-dropdown]') || target.closest('button')) return;
    onEdit?.(task);
  };

  const isDone = task.status === "DONE";

  return (
    <div>
      {/* Drop position indicator */}
      {isDropTarget && (
        <div className="h-0.5 bg-blue-500 rounded-full mx-1 -mt-1 mb-1 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
      )}
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleCardClick}
        className={`cursor-grab active:cursor-grabbing border-zinc-700 hover:border-zinc-600 transition-all hover:scale-[1.02] ${
        isDone ? "bg-zinc-900 opacity-60" : "bg-zinc-800"
      } ${task.needsReview ? "ring-2 ring-amber-500/70 ring-offset-1 ring-offset-zinc-900" : ""}`}
    >
      <CardContent className="p-3">
        {/* Header row: creator + title + menu */}
        <div className="flex items-start gap-2">
          {/* Creator emoji */}
          <span className={`text-sm flex-shrink-0 ${isDone ? "opacity-50" : ""}`}>
            {creator?.emoji}
          </span>
          
          {/* Title */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm leading-snug break-words ${isDone ? "line-through text-zinc-500" : "text-zinc-100"}`}>
              {task.title}
            </h3>
          </div>
          
          {/* Flag toggle button */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 flex-shrink-0 ${task.needsReview ? "text-amber-500" : "text-zinc-600 hover:text-amber-500"}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFlag?.(task.id);
            }}
            title={task.needsReview ? "Clear flag" : "Flag for review"}
          >
            <Flag className={`h-3.5 w-3.5 ${task.needsReview ? "fill-amber-500" : ""}`} />
          </Button>
          
          {/* Dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 -mt-0.5 flex-shrink-0"
                data-dropdown
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
              <DropdownMenuItem onClick={() => onEdit?.(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleFlag?.(task.id)}>
                <Flag className="mr-2 h-4 w-4" />
                {task.needsReview ? "Clear Flag" : "Flag for Review"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description - render as Markdown */}
        {task.description && (
          <div className={`text-xs text-zinc-400 mt-2 break-words ${isDone ? "opacity-50" : ""}`}>
            <Markdown>{task.description}</Markdown>
          </div>
        )}
        
        {/* Priority badge - only show if priority is set */}
        {priority && (
          <div className="mt-2">
            <Badge
              variant="secondary"
              className={`${priority.color} ${isDone ? "opacity-50" : ""} text-white text-[10px] px-1.5 py-0 h-4`}
            >
              {priority.label}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Delete confirmation dialog */}
    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete task</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Are you sure you want to delete &ldquo;{task.title}&rdquo;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setShowDeleteConfirm(false)}
            className="border-zinc-700"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
