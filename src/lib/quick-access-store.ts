/**
 * Quick Access Store
 * 
 * Manages user-configurable quick access file shortcuts stored in Supabase.
 * Each user has their own set of quick access items that persist across sessions.
 * 
 * @module quick-access-store
 */

import { createAdminClient } from "./supabase/server";
import { Result, ok, err } from "./result";

/**
 * Represents a quick access item stored in the database.
 */
export interface QuickAccessItem {
  id: string;
  userId: string;
  filePath: string;
  fileName: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DbQuickAccessItem {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Maps a database row to a QuickAccessItem object.
 * Converts snake_case DB fields to camelCase and parses dates.
 */
function mapDbToItem(db: DbQuickAccessItem): QuickAccessItem {
  return {
    id: db.id,
    userId: db.user_id,
    filePath: db.file_path,
    fileName: db.file_name,
    description: db.description,
    position: db.position,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

/**
 * Get all quick access items for a user
 */
export async function getQuickAccessItems(
  userId: string
): Promise<Result<QuickAccessItem[], Error>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("quick_access_items")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true });

    if (error) {
      return err(new Error(error.message));
    }

    return ok((data as DbQuickAccessItem[]).map(mapDbToItem));
  } catch (e) {
    return err(e instanceof Error ? e : new Error("Unknown error"));
  }
}

/**
 * Add a new quick access item
 */
export async function addQuickAccessItem(
  userId: string,
  filePath: string,
  fileName: string,
  description?: string
): Promise<Result<QuickAccessItem, Error>> {
  try {
    const supabase = createAdminClient();
    
    // Get max position for this user
    const { data: maxPosData } = await supabase
      .from("quick_access_items")
      .select("position")
      .eq("user_id", userId)
      .order("position", { ascending: false })
      .limit(1);
    
    const maxPosition = maxPosData?.[0]?.position ?? -1;
    
    const { data, error } = await supabase
      .from("quick_access_items")
      .insert({
        user_id: userId,
        file_path: filePath,
        file_name: fileName,
        description: description || null,
        position: maxPosition + 1,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate key error
      if (error.code === "23505") {
        return err(new Error("This file is already in Quick Access"));
      }
      return err(new Error(error.message));
    }

    return ok(mapDbToItem(data as DbQuickAccessItem));
  } catch (e) {
    return err(e instanceof Error ? e : new Error("Unknown error"));
  }
}

/**
 * Remove a quick access item
 */
export async function removeQuickAccessItem(
  id: string
): Promise<Result<void, Error>> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("quick_access_items")
      .delete()
      .eq("id", id);

    if (error) {
      return err(new Error(error.message));
    }

    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e : new Error("Unknown error"));
  }
}

/**
 * Reorder quick access items
 */
export async function reorderQuickAccessItems(
  userId: string,
  itemIds: string[]
): Promise<Result<void, Error>> {
  try {
    const supabase = createAdminClient();
    
    // Update positions in a transaction-like manner
    const updates = itemIds.map((id, index) =>
      supabase
        .from("quick_access_items")
        .update({ position: index })
        .eq("id", id)
        .eq("user_id", userId)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error);
    
    if (firstError?.error) {
      return err(new Error(firstError.error.message));
    }

    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e : new Error("Unknown error"));
  }
}

/**
 * Initialize default quick access items for a new user
 */
export async function initializeDefaultQuickAccess(
  userId: string,
  homeDir: string
): Promise<Result<QuickAccessItem[], Error>> {
  const defaults = [
    { name: "SOUL.md", path: `${homeDir}/clawd/SOUL.md`, description: "Personality & persona" },
    { name: "AGENTS.md", path: `${homeDir}/clawd/AGENTS.md`, description: "Workspace rules" },
    { name: "HEARTBEAT.md", path: `${homeDir}/clawd/HEARTBEAT.md`, description: "Periodic checks" },
    { name: "TOOLS.md", path: `${homeDir}/clawd/TOOLS.md`, description: "Tool settings" },
    { name: "USER.md", path: `${homeDir}/clawd/USER.md`, description: "User info" },
    { name: "IDENTITY.md", path: `${homeDir}/clawd/IDENTITY.md`, description: "Name & avatar" },
    { name: "MEMORY.md", path: `${homeDir}/clawd/MEMORY.md`, description: "Long-term memory" },
    { name: "clawdbot.json", path: `${homeDir}/.clawdbot/clawdbot.json`, description: "Gateway config" },
  ];

  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from("quick_access_items")
      .insert(
        defaults.map((item, index) => ({
          user_id: userId,
          file_path: item.path,
          file_name: item.name,
          description: item.description,
          position: index,
        }))
      )
      .select();

    if (error) {
      // Ignore duplicate key errors (items already exist)
      if (error.code === "23505") {
        return getQuickAccessItems(userId);
      }
      return err(new Error(error.message));
    }

    return ok((data as DbQuickAccessItem[]).map(mapDbToItem));
  } catch (e) {
    return err(e instanceof Error ? e : new Error("Unknown error"));
  }
}
