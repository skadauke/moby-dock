'use client';

import { useState, useCallback, useEffect } from "react";
import { Task, Status, COLUMNS } from "@/types/kanban";
import { Column } from "./column";
import { KanbanDndProvider } from "./kanban-dnd-context";

interface BoardProps {
  initialTasks: Task[];
  onDeleteTask?: (taskId: string) => void;
  onToggleFlag?: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, newStatus: Status, newPosition: number) => void;
  onTaskReorder?: (taskId: string, newPosition: number) => void;
}

export function Board({
  initialTasks,
  onDeleteTask,
  onToggleFlag,
  onEditTask,
  onTaskStatusChange,
  onTaskReorder,
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

  /**
   * Optimistic update for status change (moving task between columns).
   * Reindexes both source and target columns to maintain contiguous positions.
   */
  const handleTaskStatusChange = useCallback((taskId: string, newStatus: Status, newPosition: number) => {
    setTasks((prev) => {
      // Get the task being moved
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const sourceStatus = task.status;
      const isStatusChange = sourceStatus !== newStatus;

      // Get tasks in the target column (excluding the moving task)
      const targetColumnTasks = prev
        .filter(t => t.status === newStatus && t.id !== taskId)
        .sort((a, b) => a.position - b.position);

      // Update positions in target column - shift tasks at and after newPosition
      const updatedTargetTasks = targetColumnTasks.map((t, i) => ({
        ...t,
        position: i >= newPosition ? i + 1 : i,
      }));

      // Update the moved task
      const updatedTask = { ...task, status: newStatus, position: newPosition };

      // Reindex source column if moving across columns (to fill the gap)
      const updatedSourceTasks = isStatusChange
        ? prev
            .filter(t => t.status === sourceStatus && t.id !== taskId)
            .sort((a, b) => a.position - b.position)
            .map((t, i) => ({ ...t, position: i }))
        : [];

      // Get tasks not in affected columns (and not the moving task)
      const otherTasks = prev.filter(t => {
        if (t.id === taskId) return false;
        if (t.status === newStatus) return false;
        if (isStatusChange && t.status === sourceStatus) return false;
        return true;
      });

      return [...otherTasks, ...updatedSourceTasks, ...updatedTargetTasks, updatedTask];
    });
    onTaskStatusChange?.(taskId, newStatus, newPosition);
  }, [onTaskStatusChange]);

  /**
   * Optimistic update for reorder within same column.
   * Removes task from current position, inserts at new position, reindexes.
   */
  const handleTaskReorder = useCallback((taskId: string, newPosition: number) => {
    setTasks((prev) => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const columnTasks = prev
        .filter(t => t.status === task.status)
        .sort((a, b) => a.position - b.position);

      const currentIndex = columnTasks.findIndex(t => t.id === taskId);
      if (currentIndex === -1 || currentIndex === newPosition) return prev;

      // Remove from current position
      const reordered = [...columnTasks];
      const [removed] = reordered.splice(currentIndex, 1);
      
      // Insert at new position
      reordered.splice(newPosition, 0, removed);

      // Update positions to be contiguous
      const updatedColumnTasks = reordered.map((t, i) => ({ ...t, position: i }));

      // Get tasks not in this column
      const otherTasks = prev.filter(t => t.status !== task.status);

      return [...otherTasks, ...updatedColumnTasks];
    });
    onTaskReorder?.(taskId, newPosition);
  }, [onTaskReorder]);

  return (
    <KanbanDndProvider
      tasks={tasks}
      onTaskStatusChange={handleTaskStatusChange}
      onTaskReorder={handleTaskReorder}
    >
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
    </KanbanDndProvider>
  );
}
