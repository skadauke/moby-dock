"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAccessItem {
  name: string;
  path: string;
  description: string;
}

interface QuickAccessProps {
  items: QuickAccessItem[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export function QuickAccess({ items, selectedPath, onSelectFile }: QuickAccessProps) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
        Quick Access
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => onSelectFile(item.path)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded transition-colors",
              selectedPath === item.path
                ? "bg-zinc-800 text-blue-400"
                : "text-zinc-300 hover:bg-zinc-800"
            )}
          >
            <FileText className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{item.name}</div>
              <div className="truncate text-xs text-zinc-500">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
