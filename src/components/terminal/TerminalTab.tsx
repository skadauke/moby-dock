"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useTerminalStore } from "@/stores/terminal-store";

interface TerminalTabProps {
  sessionId: string;
  name: string;
  isActive: boolean;
}

export function TerminalTab({ sessionId, name, isActive }: TerminalTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setActive, removeSession, renameSession } = useTerminalStore();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      renameSession(sessionId, trimmed);
    } else {
      setEditValue(name);
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-zinc-800 select-none ${
        isActive
          ? "bg-zinc-800 text-zinc-100"
          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      }`}
      onClick={() => setActive(sessionId)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditValue(name);
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditValue(name);
              setIsEditing(false);
            }
          }}
          className="bg-zinc-700 text-zinc-100 text-xs px-1 rounded w-24 outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate max-w-[120px]">{name}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeSession(sessionId);
        }}
        className="ml-1 opacity-0 group-hover:opacity-100 hover:text-zinc-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
