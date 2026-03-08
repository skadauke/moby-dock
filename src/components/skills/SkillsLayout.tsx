"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, RefreshCw, Sparkles, Plus, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkillCard } from "./SkillCard";
import { SkillDetail } from "./SkillDetail";
import type { SkillInfo } from "./types";

export function SkillsLayout() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

  const fetchSkills = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Failed to fetch skills");
      const data = await res.json();
      setSkills(data.skills ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [skills, search]);

  const customCount = skills.filter((s) => s.source === "custom").length;
  const builtinCount = skills.filter((s) => s.source === "builtin").length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <p className="text-zinc-400">{error}</p>
        <Button onClick={fetchSkills}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-zinc-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Skills</h1>
          <Badge variant="secondary" className="ml-1 text-xs">
            {skills.length} total
          </Badge>
          {customCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30"
            >
              {customCount} custom
            </Badge>
          )}
          {builtinCount > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-zinc-700/50 text-zinc-400">
              {builtinCount} built-in
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-zinc-700"
            disabled
          >
            <Plus className="h-3.5 w-3.5" />
            New Skill
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchSkills}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 h-9 text-sm"
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-auto p-4">
        {filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
            <Sparkles className="h-10 w-10" />
            <p className="text-sm">
              {search ? "No skills match your search" : "No skills found"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.path}
                skill={skill}
                selected={selectedSkill?.path === skill.path}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedSkill && (
        <SkillDetail skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}
