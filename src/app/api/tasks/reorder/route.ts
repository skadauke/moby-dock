/**
 * Task Reorder API
 *
 * Reorder tasks within a status column.
 *
 * @module api/tasks/reorder
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reorderTasks } from "@/lib/api-store";
import { Status } from "@/types/kanban";

/**
 * POST /api/tasks/reorder
 * Reorder tasks within a column
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/tasks/reorder" });

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized task reorder attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("POST /api/tasks/reorder - invalid JSON");
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskIds, status } = body;

  if (!Array.isArray(taskIds)) {
    log.warn("POST /api/tasks/reorder - taskIds not array");
    await log.flush();
    return NextResponse.json(
      { error: "taskIds must be an array" },
      { status: 400 }
    );
  }

  // Accept both READY and IN_PROGRESS (legacy DB value)
  const validStatuses = ["BACKLOG", "READY", "IN_PROGRESS", "DONE"];
  if (!validStatuses.includes(status)) {
    log.warn("POST /api/tasks/reorder - invalid status", { status });
    await log.flush();
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  log.info("POST /api/tasks/reorder", {
    status,
    taskCount: taskIds.length,
  });

  // Map IN_PROGRESS to READY (DB compatibility)
  const mappedStatus = status === "IN_PROGRESS" ? "READY" : status;

  const startTime = Date.now();
  const result = await reorderTasks(taskIds, mappedStatus as Status);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] reorderTasks failed", {
      status,
      taskCount: taskIds.length,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] reorderTasks success", {
    status,
    taskCount: taskIds.length,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data);
}
