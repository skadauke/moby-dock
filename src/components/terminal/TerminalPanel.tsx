"use client";

import { useEffect, useRef, useCallback } from "react";
import { Plus, X, Maximize2, Minimize2 } from "lucide-react";
import { useTerminalStore } from "@/stores/terminal-store";
import { TerminalTab } from "./TerminalTab";
import { TerminalInstance } from "./TerminalInstance";

export function TerminalPanel() {
  const {
    sessions,
    activeSessionId,
    isOpen,
    panelHeight,
    isMaximized,
    toggle,
    close,
    addSession,
    setHeight,
    toggleMaximize,
  } = useTerminalStore();

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Keyboard shortcut: Cmd+`
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "`") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  // Drag resize
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: panelHeight };

      const onMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - e.clientY;
        setHeight(dragRef.current.startHeight + delta);
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelHeight, setHeight]
  );

  const sessionList = Array.from(sessions.values());
  const height = isMaximized ? "calc(100vh - 3.5rem)" : `${panelHeight}px`;

  return (
    <div
      className="flex-shrink-0 overflow-hidden transition-[height] duration-200 ease-in-out border-t border-zinc-800"
      style={{ height: isOpen ? height : "0px" }}
    >
      {/* Drag handle */}
      <div
        className="h-1 bg-zinc-800 cursor-row-resize hover:bg-zinc-700 transition-colors flex items-center justify-center"
        onMouseDown={onDragStart}
      >
        <div className="w-8 h-0.5 rounded bg-zinc-600" />
      </div>

      {/* Header */}
      <div className="flex items-center h-8 bg-zinc-900 border-b border-zinc-800 select-none">
        <span className="px-3 text-xs font-medium text-zinc-400 shrink-0">
          Terminal
        </span>

        {/* Tabs */}
        <div className="flex items-center overflow-x-auto flex-1 min-w-0">
          {sessionList.map((session) => (
            <TerminalTab
              key={session.id}
              sessionId={session.id}
              name={session.name}
              isActive={session.id === activeSessionId}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-2 shrink-0">
          <button
            onClick={() => addSession()}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="New Terminal"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleMaximize}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={close}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal instances */}
      <div
        className="bg-[#09090b]"
        style={{
          height: `calc(100% - 2.25rem - 0.25rem)`, // subtract header + drag handle
        }}
      >
        {sessionList.map((session) => (
          <TerminalInstance
            key={session.id}
            sessionId={session.id}
            isVisible={session.id === activeSessionId && isOpen}
          />
        ))}
      </div>
    </div>
  );
}
