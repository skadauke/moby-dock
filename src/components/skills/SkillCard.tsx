"use client";

import { Badge } from "@/components/ui/badge";
import type { SkillInfo } from "./types";

interface Props {
  skill: SkillInfo;
  selected: boolean;
  onClick: () => void;
}

export function SkillCard({ skill, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        selected
          ? "border-blue-500/50 bg-zinc-800/80"
          : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{skill.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-zinc-100 truncate">{skill.name}</h3>
            <Badge
              variant="secondary"
              className={`text-[10px] shrink-0 ${
                skill.source === "custom"
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                  : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30"
              }`}
            >
              {skill.source === "custom" ? "Custom" : "Built-in"}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 line-clamp-2">{skill.description || "No description"}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
            <span>{skill.fileCount} files</span>
            {skill.requires && skill.requires.length > 0 && (
              <span>requires: {skill.requires.join(", ")}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
