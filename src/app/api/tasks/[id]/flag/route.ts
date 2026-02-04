/**
 * Task Flag API
 *
 * Toggle the needs_review flag on a task.
 *
 * @module api/tasks/[id]/flag
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { toggleTaskFlag } from "@/lib/api-store";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/flag
 * Toggle needs_review flag
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/tasks/[id]/flag" });

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { id } = await params;

  if (!session?.user) {
    log.warn("POST /api/tasks/[id]/flag - unauthorized", { taskId: id });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("POST /api/tasks/[id]/flag", {
    taskId: id,
    userId: session.user.id,
  });

  const startTime = Date.now();
  const result = await toggleTaskFlag(id);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] toggleTaskFlag failed", {
      taskId: id,
      userId: session.user.id,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] toggleTaskFlag success", {
    taskId: id,
    userId: session.user.id,
    newValue: result.data.needsReview,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data);
}
