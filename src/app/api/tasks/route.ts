/**
 * Tasks API Routes
 *
 * CRUD operations for tasks in the Command section.
 * All operations are logged for audit and debugging.
 *
 * @module api/tasks
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { getAllTasks, createTask } from "@/lib/api-store";

/**
 * GET /api/tasks
 * List all tasks
 */
export async function GET() {
  const log = new Logger({ source: "api/tasks" });
  log.info("GET /api/tasks");

  const startTime = Date.now();
  const result = await getAllTasks();
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] getAllTasks failed", {
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] getAllTasks success", {
    count: result.data.length,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data);
}

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/tasks" });

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("POST /api/tasks - invalid JSON body");
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, priority, creator, projectId } = body;

  log.info("POST /api/tasks", {
    title,
    priority,
    creator,
    projectId,
  });

  if (!title || typeof title !== "string") {
    log.warn("POST /api/tasks - missing title");
    await log.flush();
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const startTime = Date.now();
  const result = await createTask({
    title,
    description,
    priority,
    creator,
    projectId,
  });
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] createTask failed", {
      error: result.error.message,
      title,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] createTask success", {
    taskId: result.data.id,
    title,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data, { status: 201 });
}
