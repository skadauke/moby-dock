/**
 * Project Reorder API
 *
 * Reorder projects in the sidebar.
 *
 * @module api/projects/reorder
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reorderProjects } from "@/lib/projects-store";

/**
 * POST /api/projects/reorder
 * Reorder projects
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/projects/reorder" });

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized project reorder attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("POST /api/projects/reorder - invalid JSON");
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectIds } = body;

  if (!Array.isArray(projectIds)) {
    log.warn("POST /api/projects/reorder - projectIds not array");
    await log.flush();
    return NextResponse.json(
      { error: "projectIds must be an array" },
      { status: 400 }
    );
  }

  log.info("POST /api/projects/reorder", {
    projectCount: projectIds.length,
  });

  const startTime = Date.now();
  const result = await reorderProjects(projectIds);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] reorderProjects failed", {
      projectCount: projectIds.length,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] reorderProjects success", {
    projectCount: projectIds.length,
    duration,
  });
  await log.flush();

  return NextResponse.json({ success: true });
}
