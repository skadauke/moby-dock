'use client';

import { Task, PRIORITIES, CREATORS } from "@/types/kanban";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onToggleFlag?: (taskId: string) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleFlag }: TaskCardProps) {
  const priority = PRIORITIES.find(p => p.value === task.priority);
  const creator = CREATORS.find(c => c.value === task.creator);

  return (
    <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-zinc-100 truncate">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          {task.needsReview && (
            <Flag className="h-4 w-4 text-amber-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          {priority && (
            <Badge variant="secondary" className={`${priority.color} text-white text-xs`}>
              {priority.label}
            </Badge>
          )}
          {creator && (
            <span className="text-xs text-zinc-500">
              {creator.emoji} {creator.label}
            </span>
          )}
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleFlag && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => { e.stopPropagation(); onToggleFlag(task.id); }}
              >
                <Flag className={`h-3 w-3 ${task.needsReview ? 'text-amber-500' : 'text-zinc-500'}`} />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              >
                <Pencil className="h-3 w-3 text-zinc-500" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              >
                <Trash2 className="h-3 w-3 text-zinc-500" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
