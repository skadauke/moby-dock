'use client';

import { Task, Status } from "@/types/kanban";
import { TaskCard } from "./task-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColumnProps {
  id: Status;
  title: string;
  tasks: Task[];
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleFlag?: (taskId: string) => void;
}

export function Column({ id, title, tasks, onEditTask, onDeleteTask, onToggleFlag }: ColumnProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-100">{title}</h2>
        <span className="text-sm text-zinc-500">{tasks.length}</span>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="group">
              <TaskCard
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onToggleFlag={onToggleFlag}
              />
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-8">
              No tasks
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
