"use client";

import { useState, useEffect } from "react";
import { Project } from "@/types/kanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Folder, ChevronLeft, ChevronRight, Trash2, Edit2, ChevronUp, ChevronDown } from "lucide-react";

interface ProjectSidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}

const PROJECT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

/**
 * Project item with edit/delete actions
 */
function ProjectItem({
  project,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div
      className={`group flex items-center gap-1 px-2 py-2 rounded-md transition-all ${
        isSelected
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
      }`}
    >
      {/* Reorder buttons */}
      <div className="flex flex-col -my-1">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className={`p-0.5 ${isFirst ? "text-zinc-700 cursor-not-allowed" : "text-zinc-600 hover:text-zinc-400"}`}
          title="Move up"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className={`p-0.5 ${isLast ? "text-zinc-700 cursor-not-allowed" : "text-zinc-600 hover:text-zinc-400"}`}
          title="Move down"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <button
        onClick={onSelect}
        onDoubleClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="flex-1 flex items-center gap-3 text-left min-w-0"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{project.name}</span>
          {project.description && (
            <span className="text-xs text-zinc-500 truncate block">{project.description}</span>
          )}
        </div>
      </button>
      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 text-zinc-500 hover:text-zinc-300"
          title="Edit"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-zinc-500 hover:text-red-400"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Sidebar for project navigation and management.
 */
export function ProjectSidebar({ selectedProjectId, onSelectProject }: ProjectSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          const sorted = data
            .map((p: Project) => ({
              ...p,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
            }))
            .sort((a: Project, b: Project) => a.position - b.position);
          setProjects(sorted);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, []);

  const handleMoveProject = async (projectId: string, direction: "up" | "down") => {
    const currentIndex = projects.findIndex(p => p.id === projectId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= projects.length) return;

    // Swap positions
    const reordered = [...projects];
    [reordered[currentIndex], reordered[newIndex]] = [reordered[newIndex], reordered[currentIndex]];
    const updated = reordered.map((p, i) => ({ ...p, position: i }));
    setProjects(updated);

    // Persist to API
    try {
      const res = await fetch("/api/projects/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: updated.map(p => p.id) }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    } catch (err) {
      console.error("Failed to reorder projects:", err);
      setProjects(projects); // Revert on error
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!projectName.trim()) return;
    setIsSubmitting(true);

    try {
      const url = editingProject 
        ? `/api/projects/${editingProject.id}`
        : "/api/projects";
      const method = editingProject ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: projectName,
          description: projectDescription.trim() || undefined,
          color: projectColor,
          position: editingProject ? undefined : projects.length,
        }),
      });

      if (res.ok) {
        const project = await res.json();
        if (editingProject) {
          setProjects(prev => prev.map(p => p.id === project.id ? {
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          } : p));
        } else {
          setProjects(prev => [...prev, {
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          }]);
        }
        closeModal();
      }
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Delete this project? Tasks will be unassigned but not deleted.")) return;
    
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (selectedProjectId === projectId) {
          onSelectProject(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
    setProjectColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setProjectColor(project.color);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
  };

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="w-12 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <button
          onClick={() => onSelectProject(null)}
          className={`mt-4 w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            selectedProjectId === null ? "bg-zinc-700" : "hover:bg-zinc-800"
          }`}
          title="All Tasks"
        >
          <Folder className="h-4 w-4 text-zinc-400" />
        </button>
        <div className="mt-2 space-y-2">
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                selectedProjectId === project.id ? "ring-2 ring-white" : ""
              }`}
              style={{ backgroundColor: project.color }}
              title={project.name}
            >
              <span className="text-white text-xs font-bold">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <>
      <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Projects
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openCreateModal}
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(true)}
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* All Tasks option */}
          <button
            onClick={() => onSelectProject(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all ${
              selectedProjectId === null
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            }`}
          >
            <Folder className="h-4 w-4" />
            <span className="text-sm font-medium">All Tasks</span>
          </button>

          {isLoading ? (
            <div className="px-3 py-4 text-sm text-zinc-500">Loading...</div>
          ) : (
            <div className="mt-2 space-y-1">
              {projects.map((project, index) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  isSelected={selectedProjectId === project.id}
                  onSelect={() => onSelectProject(project.id)}
                  onEdit={() => openEditModal(project)}
                  onDelete={() => handleDelete(project.id)}
                  onMoveUp={() => handleMoveProject(project.id, "up")}
                  onMoveDown={() => handleMoveProject(project.id, "down")}
                  isFirst={index === 0}
                  isLast={index === projects.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Project Modal */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "New Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400">Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name..."
                className="bg-zinc-900 border-zinc-800 mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Description</label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Project description (optional)..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 mt-1 text-sm text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Color</label>
              <div className="flex gap-2 mt-2">
                {PROJECT_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setProjectColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      projectColor === color ? "ring-2 ring-white scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-zinc-700">
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrUpdate}
              disabled={!projectName.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? "Saving..." : editingProject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
