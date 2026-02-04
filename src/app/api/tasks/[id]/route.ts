/**
 * Task Detail API Routes
 *
 * Single task operations: get, update, delete.
 *
 * @module api/tasks/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";
import { getTaskById, updateTask, deleteTask } from "@/lib/api-store";

/** Allowed fields for PATCH updates (whitelist) */
const ALLOWED_UPDATE_FIELDS = [
  'title', 'description', 'status', 'priority', 'flagged',
  'dueDate', 'projectId', 'details', 'position'
] as const;

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]
 * Get a single task by ID
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/tasks/[id]" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized task read attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  log.info("GET /api/tasks/[id]", { taskId: id, userId: authResult.userId });

  const startTime = Date.now();
  const result = await getTaskById(id);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.warn("[Supabase] getTaskById failed", {
      taskId: id,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] getTaskById success", { taskId: id, duration });
  await log.flush();

  return NextResponse.json(result.data);
}

/**
 * PATCH /api/tasks/[id]
 * Update a task
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/tasks/[id]" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized task update attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("PATCH /api/tasks/[id] - invalid JSON", { taskId: id });
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    log.warn("PATCH /api/tasks/[id] - invalid body type", { taskId: id });
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Filter to only allowed fields (whitelist)
  const providedFields = Object.keys(body);
  const filteredUpdate: Record<string, unknown> = {};
  const allowedFieldsSet = new Set<string>(ALLOWED_UPDATE_FIELDS);
  
  for (const field of providedFields) {
    if (allowedFieldsSet.has(field)) {
      filteredUpdate[field] = body[field];
    }
  }
  
  const updatedFields = Object.keys(filteredUpdate);
  const rejectedFields = providedFields.filter(f => !allowedFieldsSet.has(f));
  
  if (rejectedFields.length > 0) {
    log.warn("PATCH /api/tasks/[id] - rejected fields", { 
      taskId: id, 
      rejectedFields 
    });
  }
  
  if (updatedFields.length === 0) {
    log.warn("PATCH /api/tasks/[id] - no valid fields", { taskId: id });
    await log.flush();
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  log.info("PATCH /api/tasks/[id]", {
    taskId: id,
    updatedFields,
  });

  const startTime = Date.now();
  const result = await updateTask(id, filteredUpdate);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] updateTask failed", {
      taskId: id,
      updatedFields,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] updateTask success", {
    taskId: id,
    updatedFields,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data);
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/tasks/[id]" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized task delete attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  log.info("DELETE /api/tasks/[id]", { taskId: id, userId: authResult.userId });

  const startTime = Date.now();
  const result = await deleteTask(id);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] deleteTask failed", {
      taskId: id,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] deleteTask success", { taskId: id, duration });
  await log.flush();

  return NextResponse.json({ success: true });
}
