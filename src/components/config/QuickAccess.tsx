"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAccessItem {
  id: string;
  filePath: string;
  fileName: string;
  description: string | null;
  position: number;
}

interface QuickAccessProps {
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onItemAdded?: () => void; // Callback when item is added externally
}

interface SortableItemProps {
  item: QuickAccessItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableItem({ item, isSelected, onSelect, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 px-1 py-1.5 text-sm rounded transition-colors",
        isSelected
          ? "bg-zinc-800 text-blue-400"
          : "text-zinc-300 hover:bg-zinc-800"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="p-0.5 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* File content - clickable */}
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 text-left min-w-0"
      >
        <FileText className="h-4 w-4 text-zinc-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{item.fileName}</div>
          {item.description && (
            <div className="truncate text-xs text-zinc-500">{item.description}</div>
          )}
        </div>
      </button>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove from Quick Access"
        className="p-1 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
        title="Remove from Quick Access"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DragOverlayItem({ item }: { item: QuickAccessItem }) {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5 text-sm bg-zinc-800 text-zinc-300 rounded shadow-lg">
      <GripVertical className="h-3.5 w-3.5 text-zinc-600" />
      <FileText className="h-4 w-4 text-zinc-500" />
      <span className="font-medium">{item.fileName}</span>
    </div>
  );
}

export function QuickAccess({ selectedPath, onSelectFile, onItemAdded }: QuickAccessProps) {
  const [items, setItems] = useState<QuickAccessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<QuickAccessItem | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Make the component a drop target for files from FileTree
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "quick-access-drop",
    data: { type: "quick-access" },
  });

  // Fetch items on mount
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/quick-access");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  // Native HTML5 drag-and-drop handlers
  const handleNativeDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsOverDropZone(true);
  }, []);

  const handleNativeDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only leave if we're actually leaving the drop zone
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsOverDropZone(false);
      }
    }
  }, []);

  const handleNativeDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOverDropZone(false);

    try {
      const data = e.dataTransfer.getData("text/plain");
      if (data) {
        const { path, name } = JSON.parse(data);
        if (path && name) {
          await addItem(path, name);
        }
      }
    } catch (err) {
      console.error("Failed to parse drop data:", err);
    }
  }, []);

  const addItem = async (filePath: string, fileName: string) => {
    // Check if already exists
    if (items.some((i) => i.filePath === filePath)) {
      return; // Already in list
    }

    try {
      const res = await fetch("/api/quick-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, fileName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add");
      }
      const newItem = await res.json();
      setItems((prev) => [...prev, newItem]);
      onItemAdded?.();
    } catch (err) {
      console.error("Failed to add to Quick Access:", err);
    }
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const item = items.find((i) => i.id === id);
      if (item) setActiveItem(item);
    },
    [items]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveItem(null);
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistic update
      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);

      // Persist to server
      try {
        const res = await fetch("/api/quick-access/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: reordered.map((i) => i.id) }),
        });
        if (!res.ok) throw new Error("Failed to reorder");
      } catch {
        // Revert on error
        fetchItems();
      }
    },
    [items]
  );

  const handleRemove = useCallback(async (id: string) => {
    // Optimistic update
    setItems((prev) => prev.filter((i) => i.id !== id));

    try {
      const res = await fetch(`/api/quick-access/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
    } catch {
      // Revert on error
      fetchItems();
    }
  }, []);

  // Expose the add handler for parent components (via (+) button)
  useEffect(() => {
    (window as unknown as { __quickAccessAdd?: typeof addItem }).__quickAccessAdd = addItem;
    return () => {
      delete (window as unknown as { __quickAccessAdd?: typeof addItem }).__quickAccessAdd;
    };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Combine refs for drop zone
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      (dropZoneRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      setDropRef(node);
    },
    [setDropRef]
  );

  if (isLoading) {
    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
          Quick Access
        </h3>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
          Quick Access
        </h3>
        <div className="text-xs text-red-400 px-2">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-4 p-1 rounded-lg transition-all",
        (isOverDropZone || isOver) && "bg-blue-500/10 ring-2 ring-blue-500/50"
      )}
      ref={setRefs}
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
    >
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
        Quick Access
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5 rounded transition-colors min-h-[40px]">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isSelected={selectedPath === item.filePath}
                onSelect={() => onSelectFile(item.filePath)}
                onRemove={() => handleRemove(item.id)}
              />
            ))}
            {items.length === 0 && (
              <div className="text-xs text-zinc-500 px-2 py-4 text-center">
                Drag files here from Browse
              </div>
            )}
          </div>
        </SortableContext>

        <DragOverlay>{activeItem && <DragOverlayItem item={activeItem} />}</DragOverlay>
      </DndContext>
    </div>
  );
}
