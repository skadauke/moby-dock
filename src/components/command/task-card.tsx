'use client';

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, PRIORITIES, CREATORS } from "@/types/kanban";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Flag, Trash2, Pencil } from "lucide-react";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onToggleFlag?: (taskId: string) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleFlag }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = PRIORITIES.find((p) => p.value === task.priority);
  const creator = CREATORS.find((c) => c.value === task.creator);

  const handleDelete = () => {
    if (confirm("Delete this task?")) {
      onDelete?.(task.id);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on dropdown or dragging
    const target = e.target as HTMLElement;
    if (target.closest('[data-dropdown]') || target.closest('button')) return;
    onEdit?.(task);
  };

  const isDone = task.status === "DONE";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={`cursor-grab active:cursor-grabbing border-zinc-800 hover:border-zinc-700 transition-all hover:scale-[1.02] ${
        isDone ? "bg-zinc-950 opacity-60" : "bg-zinc-900"
      } ${task.needsReview ? "ring-2 ring-amber-500/50" : ""}`}
    >
      <CardContent className="p-2.5">
        {/* Top row: avatar, flag, menu */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm ${isDone ? "opacity-50" : ""}`}>{creator?.emoji}</span>
            {task.needsReview && (
              <Flag className="h-3 w-3 text-amber-500 fill-amber-500" />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1"
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

        {/* Title - with proper wrapping */}
        <h3 className={`font-medium text-sm leading-snug mb-1 break-words ${isDone ? "line-through text-zinc-500" : ""}`}>
          {task.title}
        </h3>
        
        {/* Description (if any) - with proper wrapping */}
        {task.description && (
          <p className="text-xs text-zinc-400 line-clamp-2 mb-1.5 break-words">
            {task.description}
          </p>
        )}
        
        {/* Priority badge - only show if priority is set */}
        {priority && (
          <Badge
            variant="secondary"
            className={`${priority.color} ${isDone ? "opacity-50" : ""} text-white text-[10px] px-1.5 py-0 h-4`}
          >
            {priority.label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
