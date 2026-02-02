import { Task, Status, Priority, Creator, normalizeStatus } from "@/types/kanban";
import { createAdminClient } from "./supabase/server";
import { Result, ok, err, DbError } from "./result";

// Database row type (matches Supabase table schema)
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  creator: string;
  needs_review: boolean;
  position: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

// Map Status to database value (READY → IN_PROGRESS for backwards compatibility)
function statusToDb(status: Status): string {
  return status === "READY" ? "IN_PROGRESS" : status;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: normalizeStatus(row.status), // IN_PROGRESS → READY
    priority: row.priority as Priority,
    creator: row.creator as Creator,
    needsReview: row.needs_review,
    position: row.position,
    projectId: row.project_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getAllTasks(): Promise<Result<Task[], DbError>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("status", { ascending: true })
      .order("position", { ascending: true });

    if (error) {
      console.error("Failed to get tasks:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    return ok((data || []).map((row: TaskRow) => rowToTask(row)));
  } catch (error) {
    console.error("Failed to get tasks:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function getTaskById(id: string): Promise<Result<Task, DbError>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return err(new DbError("Task not found", "NOT_FOUND"));
      }
      console.error("Failed to get task:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!data) {
      return err(new DbError("Task not found", "NOT_FOUND"));
    }

    return ok(rowToTask(data as TaskRow));
  } catch (error) {
    console.error("Failed to get task:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function createTask(data: {
  title: string;
  description?: string;
  priority?: Priority;
  creator?: Creator;
  projectId?: string;
}): Promise<Result<Task, DbError>> {
  try {
    const supabase = createAdminClient();

    // Get max position
    const { data: maxPosData, error: posError } = await supabase
      .from("tasks")
      .select("position")
      .eq("status", "BACKLOG")
      .order("position", { ascending: false })
      .limit(1);

    if (posError) {
      console.error("Failed to get max position:", posError);
      return err(new DbError(posError.message, "CONNECTION"));
    }

    const maxPos = maxPosData?.[0]?.position ?? -1;

    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert({
        title: data.title,
        description: data.description || null,
        status: "BACKLOG",
        priority: data.priority || null,
        creator: data.creator || "MOBY",
        needs_review: false,
        position: maxPos + 1,
        project_id: data.projectId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create task:", error);
      if (error.code === "23503") {
        return err(new DbError("Invalid project ID", "CONSTRAINT"));
      }
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!newTask) {
      return err(new DbError("Task created but no data returned", "UNKNOWN"));
    }

    return ok(rowToTask(newTask as TaskRow));
  } catch (error) {
    console.error("Failed to create task:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    status: Status;
    priority: Priority;
    creator: Creator;
    needsReview: boolean;
    position: number;
    projectId: string | null;
  }>
): Promise<Result<Task, DbError>> {
  try {
    const supabase = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = statusToDb(data.status);
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.creator !== undefined) updates.creator = data.creator;
    if (data.needsReview !== undefined) updates.needs_review = data.needsReview;
    if (data.position !== undefined) updates.position = data.position;
    if (data.projectId !== undefined) updates.project_id = data.projectId;

    if (Object.keys(updates).length === 0) {
      return getTaskById(id);
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return err(new DbError("Task not found", "NOT_FOUND"));
      }
      if (error.code === "23503") {
        return err(new DbError("Invalid project ID", "CONSTRAINT"));
      }
      console.error("Failed to update task:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!updated) {
      return err(new DbError("Task not found", "NOT_FOUND"));
    }

    return ok(rowToTask(updated as TaskRow));
  } catch (error) {
    console.error("Failed to update task:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function deleteTask(id: string): Promise<Result<void, DbError>> {
  try {
    const supabase = createAdminClient();
    
    // First check if task exists
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", id)
      .single();
    
    if (!existing) {
      return err(new DbError("Task not found", "NOT_FOUND"));
    }

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    
    if (error) {
      console.error("Failed to delete task:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    return ok(undefined);
  } catch (error) {
    console.error("Failed to delete task:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function reorderTasks(
  taskIds: string[],
  status: Status
): Promise<Result<Task[], DbError>> {
  try {
    const supabase = createAdminClient();
    const updatedAt = new Date().toISOString();
    const dbStatus = statusToDb(status);

    // Update each task's position individually
    const updatePromises = taskIds.map((id, index) =>
      supabase
        .from("tasks")
        .update({ status: dbStatus, position: index, updated_at: updatedAt })
        .eq("id", id)
        .select()
        .single()
    );

    const results = await Promise.all(updatePromises);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error("Failed to reorder tasks:", errors[0].error);
      return err(new DbError(errors[0].error!.message, "CONNECTION"));
    }

    const tasks = results
      .filter(r => r.data)
      .map(r => rowToTask(r.data as TaskRow));

    return ok(tasks);
  } catch (error) {
    console.error("Failed to reorder tasks:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}

export async function toggleTaskFlag(id: string): Promise<Result<Task, DbError>> {
  const taskResult = await getTaskById(id);
  if (!taskResult.ok) {
    return taskResult;
  }

  try {
    const supabase = createAdminClient();
    const { data: updated, error } = await supabase
      .from("tasks")
      .update({
        needs_review: !taskResult.data.needsReview,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to toggle flag:", error);
      return err(new DbError(error.message, "CONNECTION"));
    }

    if (!updated) {
      return err(new DbError("Task not found", "NOT_FOUND"));
    }

    return ok(rowToTask(updated as TaskRow));
  } catch (error) {
    console.error("Failed to toggle flag:", error);
    return err(new DbError(String(error), "UNKNOWN"));
  }
}
