'use client';

import { useState, useCallback, useRef } from "react";
import { Task, Status } from "@/types/kanban";
import { Board } from "@/components/command/board";
import { TaskModal } from "@/components/command/task-modal";

interface CommandClientProps {
  initialTasks: Task[];
}

export function CommandClient({ initialTasks }: CommandClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Use ref to access current tasks in callbacks without stale closure issues
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

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
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [...prev, newTask]);
  };

  /**
   * Persist task order to the server.
   * Computes the current order from tasksRef and sends to API.
   */
  const persistTaskOrder = useCallback(async (status: Status) => {
    const currentTasks = tasksRef.current;
    const columnTasks = currentTasks
      .filter(t => t.status === status)
      .sort((a, b) => a.position - b.position);
    
    const taskIds = columnTasks.map(t => t.id);
    
    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, status }),
      });
      if (!res.ok) {
        console.error('Failed to persist task order');
      }
    } catch (err) {
      console.error('Reorder API call failed:', err);
    }
  }, []);

  // Handle task status change (drag between columns)
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: Status, _newPosition: number) => {
    // The Board already updated local state optimistically
    // We need to persist: 1) the task's new status, 2) the new column order
    try {
      // Update the task's status
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task status');
      
      // Persist the new order for the target column
      await persistTaskOrder(newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
      // TODO: Could revert optimistic update here
    }
  }, [persistTaskOrder]);

  // Handle task reorder within same column
  const handleTaskReorder = useCallback(async (taskId: string, _newPosition: number) => {
    // The Board already updated local state optimistically
    // Find the task's status and persist the new order
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;

    try {
      await persistTaskOrder(task.status);
    } catch (error) {
      console.error('Failed to reorder task:', error);
    }
  }, [persistTaskOrder]);

  return (
    <div className="h-full flex flex-col">
      <Board
        initialTasks={tasks}
        onDeleteTask={handleDeleteTask}
        onToggleFlag={handleToggleFlag}
        onEditTask={handleEditTask}
        onTaskStatusChange={handleTaskStatusChange}
        onTaskReorder={handleTaskReorder}
      />

      <TaskModal
        open={isModalOpen}
        onClose={handleCloseModal}
        task={editingTask}
        onTaskUpdated={handleTaskUpdated}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}
