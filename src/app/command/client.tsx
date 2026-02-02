'use client';

import { useState, useCallback } from "react";
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

  // Handle task status change (drag between columns)
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: Status, newPosition: number) => {
    // Get the optimistically updated tasks from state
    // The Board already updated local state optimistically, so we just need to persist
    try {
      // First update the task's status
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task status');
      
      // Then get the current order of tasks in that column and persist it
      // We'll compute this from the current state after optimistic update
      setTasks((currentTasks) => {
        const columnTasks = currentTasks
          .filter(t => t.status === newStatus)
          .sort((a, b) => a.position - b.position);
        
        const taskIds = columnTasks.map(t => t.id);
        
        // Fire and forget the reorder call
        fetch('/api/tasks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, status: newStatus }),
        }).catch(err => console.warn('Reorder API call failed:', err));
        
        return currentTasks; // Don't modify state here
      });
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Could revert optimistic update here if needed
    }
  }, []);

  // Handle task reorder within same column
  const handleTaskReorder = useCallback(async (taskId: string, _newPosition: number) => {
    // The Board already updated local state optimistically
    // We just need to persist the new order
    setTasks((currentTasks) => {
      const task = currentTasks.find(t => t.id === taskId);
      if (!task) return currentTasks;

      const columnTasks = currentTasks
        .filter(t => t.status === task.status)
        .sort((a, b) => a.position - b.position);
      
      const taskIds = columnTasks.map(t => t.id);
      
      // Fire and forget the reorder call
      fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, status: task.status }),
      }).catch(err => console.warn('Reorder API call failed:', err));
      
      return currentTasks; // Don't modify state here
    });
  }, []);

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
