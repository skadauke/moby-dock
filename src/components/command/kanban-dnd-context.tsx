'use client';

import { ReactNode, createContext, useContext, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  rectIntersection,
  CollisionDetection,
  pointerWithin,
} from "@dnd-kit/core";
import { Task, Status, COLUMNS } from "@/types/kanban";
import { TaskCard } from "./task-card";

interface KanbanDndContextValue {
  activeTask: Task | null;
  isDraggingTask: boolean;
}

const KanbanDndStateContext = createContext<KanbanDndContextValue>({
  activeTask: null,
  isDraggingTask: false,
});

export function useKanbanDnd() {
  return useContext(KanbanDndStateContext);
}

interface KanbanDndProviderProps {
  children: ReactNode;
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: Status, newPosition: number) => void;
  onTaskProjectChange?: (taskId: string, projectId: string | null) => void;
  onTaskReorder: (taskId: string, newPosition: number) => void;
  disabled?: boolean;
}

export function KanbanDndProvider({
  children,
  tasks,
  onTaskStatusChange,
  onTaskProjectChange,
  onTaskReorder,
  disabled = false,
}: KanbanDndProviderProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Disable sensors when DnD is disabled (e.g., during filtering)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: disabled ? Infinity : 8 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    const task = tasks.find((t) => t.id === id);
    if (task) {
      setActiveTask(task);
    }
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the dragged task
    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Check if dropped on a project target
    if (overId.startsWith("project-drop-")) {
      const projectId = overId.replace("project-drop-", "");
      const targetProjectId = projectId === "none" ? null : projectId;
      if (draggedTask.projectId !== targetProjectId && onTaskProjectChange) {
        onTaskProjectChange(activeId, targetProjectId);
      }
      return;
    }

    // Check if dropped on a column
    const overColumn = COLUMNS.find((c) => c.id === overId);
    if (overColumn) {
      const columnTasks = tasks
        .filter(t => t.status === overColumn.id && t.id !== activeId)
        .sort((a, b) => a.position - b.position);
      const newPosition = columnTasks.length;
      
      if (draggedTask.status !== overColumn.id || draggedTask.position !== newPosition) {
        onTaskStatusChange(activeId, overColumn.id, newPosition);
      }
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const columnTasks = tasks
        .filter(t => t.status === overTask.status)
        .sort((a, b) => a.position - b.position);
      const overIndex = columnTasks.findIndex(t => t.id === overId);
      
      if (draggedTask.status !== overTask.status) {
        onTaskStatusChange(activeId, overTask.status, overIndex);
      } else if (draggedTask.position !== overIndex) {
        onTaskReorder(activeId, overIndex);
      }
    }
  }, [tasks, onTaskStatusChange, onTaskProjectChange, onTaskReorder]);

  // Custom collision detection: prioritize project drops, then use pointer position for columns
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // Use pointer-within for project drops (more precise for sidebar)
    const pointerCollisions = pointerWithin(args);
    const projectHit = pointerCollisions.find(c => 
      (c.id as string).startsWith("project-drop-")
    );
    if (projectHit) {
      return [projectHit];
    }
    
    // Check which column the pointer is over using rect intersection
    const rectCollisions = rectIntersection(args);
    const columnHit = rectCollisions.find(c => 
      COLUMNS.some(col => col.id === c.id)
    );
    
    // Use closest center to find nearby task cards
    const centerCollisions = closestCenter(args);
    
    // Find task cards that are in the same column as where the pointer is
    const taskHit = centerCollisions.find(c => {
      const id = c.id as string;
      // Skip columns and project drops
      if (COLUMNS.some(col => col.id === id) || id.startsWith("project-drop-")) {
        return false;
      }
      // If we have a column hit, only accept task cards in that column
      if (columnHit) {
        const task = tasks.find(t => t.id === id);
        return task && task.status === columnHit.id;
      }
      return true;
    });
    
    if (taskHit) {
      return [taskHit];
    }
    
    // If no task card in current column, return the column itself
    if (columnHit) {
      return [columnHit];
    }

    return centerCollisions;
  }, [tasks]);

  return (
    <KanbanDndStateContext.Provider value={{ activeTask, isDraggingTask: !!activeTask }}>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <div className="rotate-3 opacity-90">
              <TaskCard
                task={activeTask}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggleFlag={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </KanbanDndStateContext.Provider>
  );
}
