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
  onAddTask?: (status: Status) => void;
  // Pass reordered task IDs and status directly to avoid stale state issues
  onTaskStatusChange?: (taskId: string, newStatus: Status, newPosition: number, reorderedTaskIds: string[]) => void;
  onTaskReorder?: (taskId: string, status: Status, newPosition: number, reorderedTaskIds: string[]) => void;
  // Disable DnD when filters are active (filtered list would corrupt ordering)
  disableDragDrop?: boolean;
}

export function Board({
  initialTasks,
  onDeleteTask,
  onToggleFlag,
  onEditTask,
  onAddTask,
  onTaskStatusChange,
  onTaskReorder,
  disableDragDrop = false,
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
   * Returns the reordered task IDs to the parent for persistence.
   */
  const handleTaskStatusChange = useCallback((taskId: string, newStatus: Status, newPosition: number) => {
    let reorderedTaskIds: string[] = [];
    
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

      // Insert the moved task at the new position
      const reorderedTargetTasks = [...targetColumnTasks];
      reorderedTargetTasks.splice(newPosition, 0, task);
      
      // Update positions and capture the new order
      const updatedTargetTasks = reorderedTargetTasks.map((t, i) => ({
        ...t,
        status: newStatus,
        position: i,
      }));
      
      // Capture the reordered task IDs for persistence
      reorderedTaskIds = updatedTargetTasks.map(t => t.id);

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

      return [...otherTasks, ...updatedSourceTasks, ...updatedTargetTasks];
    });
    
    // Only call parent if a change actually occurred
    if (reorderedTaskIds.length > 0) {
      onTaskStatusChange?.(taskId, newStatus, newPosition, reorderedTaskIds);
    }
  }, [onTaskStatusChange]);

  /**
   * Optimistic update for reorder within same column.
   * Removes task from current position, inserts at new position, reindexes.
   * Returns the reordered task IDs and status to the parent for persistence.
   */
  const handleTaskReorder = useCallback((taskId: string, newPosition: number) => {
    let reorderedTaskIds: string[] = [];
    let taskStatus: Status | null = null;
    
    setTasks((prev) => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      
      taskStatus = task.status;

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
      
      // Capture the reordered task IDs for persistence
      reorderedTaskIds = updatedColumnTasks.map(t => t.id);

      // Get tasks not in this column
      const otherTasks = prev.filter(t => t.status !== task.status);

      return [...otherTasks, ...updatedColumnTasks];
    });
    
    // Only call parent if a change actually occurred
    if (reorderedTaskIds.length > 0 && taskStatus) {
      onTaskReorder?.(taskId, taskStatus, newPosition, reorderedTaskIds);
    }
  }, [onTaskReorder]);

  return (
    <KanbanDndProvider
      tasks={tasks}
      onTaskStatusChange={handleTaskStatusChange}
      onTaskReorder={handleTaskReorder}
      disabled={disableDragDrop}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 h-full min-h-0">
        {COLUMNS.map((column) => (
          <Column
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={getTasksByStatus(column.id)}
            onEditTask={onEditTask}
            onDeleteTask={handleDeleteTask}
            onToggleFlag={handleToggleFlag}
            onAddTask={onAddTask}
          />
        ))}
      </div>
    </KanbanDndProvider>
  );
}
