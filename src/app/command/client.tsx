'use client';

import { useState } from "react";
import { Task, Project } from "@/types/kanban";
import { Board } from "@/components/command/board";

interface CommandClientProps {
  initialTasks: Task[];
  projects: Project[];
}

export function CommandClient({ initialTasks, projects }: CommandClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleToggleFlag = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/flag`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle flag');
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (error) {
      console.error('Failed to toggle flag:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    // TODO: Open edit modal
    console.log('Edit task:', task);
  };

  return (
    <div className="h-full flex flex-col">
      <Board
        initialTasks={tasks}
        onDeleteTask={handleDeleteTask}
        onToggleFlag={handleToggleFlag}
        onEditTask={handleEditTask}
      />
    </div>
  );
}
