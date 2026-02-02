'use client';

import { useState, useCallback, useEffect } from "react";
import { Task, Status, COLUMNS } from "@/types/kanban";
import { Column } from "./column";

interface BoardProps {
  initialTasks: Task[];
  onDeleteTask?: (taskId: string) => void;
  onToggleFlag?: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
}

export function Board({
  initialTasks,
  onDeleteTask,
  onToggleFlag,
  onEditTask,
}: BoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const getTasksByStatus = useCallback(
    (status: Status) => {
      return tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.position - b.position);
    },
    [tasks]
  );

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    onDeleteTask?.(taskId);
  };

  const handleToggleFlag = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, needsReview: !t.needsReview } : t
      )
    );
    onToggleFlag?.(taskId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 h-full">
      {COLUMNS.map((column) => (
        <Column
          key={column.id}
          id={column.id}
          title={column.title}
          tasks={getTasksByStatus(column.id)}
          onEditTask={onEditTask}
          onDeleteTask={handleDeleteTask}
          onToggleFlag={handleToggleFlag}
        />
      ))}
    </div>
  );
}
