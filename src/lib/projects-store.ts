import { Project } from "@/types/kanban";
import { createAdminClient } from "./supabase/server";
import { Result, ok, err, DbError } from "./result";

// Database row type
interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    position: row.position,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getAllProjects(): Promise<Result<Project[], DbError>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      console.error("Failed to get projects:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    return ok((data || []).map((row: ProjectRow) => rowToProject(row)));
  } catch (error) {
    console.error("Failed to get projects:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function getProjectById(id: string): Promise<Result<Project, DbError>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return err(new DbError("Project not found", "NOT_FOUND"));
      }
      console.error("Failed to get project:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!data) {
      return err(new DbError("Project not found", "NOT_FOUND"));
    }

    return ok(rowToProject(data as ProjectRow));
  } catch (error) {
    console.error("Failed to get project:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function createProject(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<Result<Project, DbError>> {
  try {
    const supabase = createAdminClient();

    // Get max position
    const { data: maxPosData, error: posError } = await supabase
      .from("projects")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);

    if (posError) {
      console.error("Failed to get max position:", posError);
      return err(new DbError(posError.message, "CONNECTION"));
    }

    const maxPos = maxPosData?.[0]?.position ?? -1;

    const { data: newProject, error } = await supabase
      .from("projects")
      .insert({
        name: data.name,
        description: data.description || null,
        color: data.color || "#3b82f6",
        position: maxPos + 1,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create project:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!newProject) {
      return err(new DbError("Project created but no data returned", "UNKNOWN"));
    }

    return ok(rowToProject(newProject as ProjectRow));
  } catch (error) {
    console.error("Failed to create project:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function updateProject(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    color: string;
    position: number;
  }>
): Promise<Result<Project, DbError>> {
  try {
    const supabase = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.color !== undefined) updates.color = data.color;
    if (data.position !== undefined) updates.position = data.position;

    if (Object.keys(updates).length === 0) {
      return getProjectById(id);
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return err(new DbError("Project not found", "NOT_FOUND"));
      }
      console.error("Failed to update project:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!updated) {
      return err(new DbError("Project not found", "NOT_FOUND"));
    }

    return ok(rowToProject(updated as ProjectRow));
  } catch (error) {
    console.error("Failed to update project:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function deleteProject(id: string): Promise<Result<void, DbError>> {
  try {
    const supabase = createAdminClient();
    
    // First check if project exists
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .single();
    
    if (!existing) {
      return err(new DbError("Project not found", "NOT_FOUND"));
    }

    // Unset projectId for all tasks in this project
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ project_id: null, updated_at: new Date().toISOString() })
      .eq("project_id", id);
    
    if (taskError) {
      console.error("Failed to unassign tasks from project:", taskError);
      return err(new DbError("Failed to unassign tasks: " + taskError.message, "CONNECTION"));
    }

    // Now delete the project
    const { error } = await supabase.from("projects").delete().eq("id", id);
    
    if (error) {
      console.error("Failed to delete project:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    return ok(undefined);
  } catch (error) {
    console.error("Failed to delete project:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function reorderProjects(projectIds: string[]): Promise<Result<void, DbError>> {
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    
    const updatePromises = projectIds.map((id, position) =>
      supabase
        .from("projects")
        .update({ position, updated_at: now })
        .eq("id", id)
    );

    const results = await Promise.all(updatePromises);
    
    const failedUpdate = results.find(r => r.error);
    if (failedUpdate?.error) {
      console.error("Failed to reorder projects:", failedUpdate.error);
      return err(new DbError(failedUpdate.error.message, "CONNECTION"));
    }

    return ok(undefined);
  } catch (error) {
    console.error("Failed to reorder projects:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}
