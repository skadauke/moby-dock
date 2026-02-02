'use client';

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col h-full bg-zinc-900 rounded-lg border transition-colors ${
        isOver ? "border-blue-500 bg-blue-500/5" : "border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-100">{title}</h2>
        <span className="text-sm text-zinc-500">{tasks.length}</span>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onToggleFlag={onToggleFlag}
              />
            ))}
            {tasks.length === 0 && (
              <div className="text-center text-zinc-500 text-sm py-8">
                No tasks
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
