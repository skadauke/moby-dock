/**
 * Task Detail API Routes
 *
 * Single task operations: get, update, delete.
 *
 * @module api/tasks/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTaskById, updateTask, deleteTask } from "@/lib/api-store";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]
 * Get a single task by ID
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/tasks/[id]" });
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized task read attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  log.info("GET /api/tasks/[id]", { taskId: id, userId: session.user.id });

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
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
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

  // Log what fields are being updated (without values for privacy)
  const updatedFields = Object.keys(body);
  log.info("PATCH /api/tasks/[id]", {
    taskId: id,
    updatedFields,
  });

  const startTime = Date.now();
  const result = await updateTask(id, body);
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
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized task delete attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  log.info("DELETE /api/tasks/[id]", { taskId: id, userId: session.user.id });

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
