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
import { FileText, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  QuickAccessItem,
  loadQuickAccessItems,
  saveQuickAccessItems,
  addQuickAccessItem as addItem,
  removeQuickAccessItem as removeItem,
} from "@/lib/quick-access-local";

interface QuickAccessProps {
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  homeDir: string;
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

export function QuickAccess({ selectedPath, onSelectFile, homeDir }: QuickAccessProps) {
  const [items, setItems] = useState<QuickAccessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const handleNativeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOverDropZone(false);

    try {
      const data = e.dataTransfer.getData("text/plain");
      if (data) {
        const { path, name } = JSON.parse(data);
        if (path && name) {
          const newItem = addItem(path, name);
          if (newItem) {
            setItems((prev) => [...prev, newItem]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse drop data:", err);
    }
  }, []);

  // Load items on mount
  useEffect(() => {
    const loadItems = () => {
      const stored = loadQuickAccessItems();
      if (stored.length === 0) {
        // Initialize with defaults
        const defaults = getDefaultItems(homeDir);
        saveQuickAccessItems(defaults);
        setItems(defaults);
      } else {
        setItems(stored);
      }
      setIsLoading(false);
    };

    loadItems();
  }, [homeDir]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const item = items.find((i) => i.id === id);
      if (item) setActiveItem(item);
    },
    [items]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder and persist
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index,
      }));
      setItems(reordered);
      saveQuickAccessItems(reordered);
    },
    [items]
  );

  const handleRemove = useCallback((id: string) => {
    removeItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Combine refs - must be before any conditional returns
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
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-4 p-1 rounded-lg transition-all",
        isOverDropZone && "bg-blue-500/10 ring-2 ring-blue-500/50"
      )}
      ref={setRefs}
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
    >
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
        Quick Access
        <span className="text-[10px] font-normal ml-1 text-zinc-600">(drag files here)</span>
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div
            className={cn(
              "space-y-0.5 rounded transition-colors min-h-[40px]",
              isOver && "bg-blue-500/10 ring-1 ring-blue-500/50"
            )}
          >
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

        <DragOverlay>
          {activeItem && <DragOverlayItem item={activeItem} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Helper to get default items
function getDefaultItems(homeDir: string): QuickAccessItem[] {
  const defaults = [
    { name: "SOUL.md", path: `${homeDir}/clawd/SOUL.md`, description: "Personality & persona" },
    { name: "AGENTS.md", path: `${homeDir}/clawd/AGENTS.md`, description: "Workspace rules" },
    { name: "HEARTBEAT.md", path: `${homeDir}/clawd/HEARTBEAT.md`, description: "Periodic checks" },
    { name: "TOOLS.md", path: `${homeDir}/clawd/TOOLS.md`, description: "Tool settings" },
    { name: "USER.md", path: `${homeDir}/clawd/USER.md`, description: "User info" },
    { name: "IDENTITY.md", path: `${homeDir}/clawd/IDENTITY.md`, description: "Name & avatar" },
    { name: "MEMORY.md", path: `${homeDir}/clawd/MEMORY.md`, description: "Long-term memory" },
    { name: "openclaw.json", path: `${homeDir}/.openclaw/openclaw.json`, description: "Gateway config" },
  ];

  return defaults.map((item, index) => ({
    id: `qa-default-${index}`,
    filePath: item.path,
    fileName: item.name,
    description: item.description,
    position: index,
  }));
}

export type { QuickAccessItem };
