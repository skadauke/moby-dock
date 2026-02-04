/**
 * Project Reorder API
 *
 * Reorder projects in the sidebar.
 *
 * @module api/projects/reorder
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";
import { reorderProjects } from "@/lib/projects-store";

/**
 * POST /api/projects/reorder
 * Reorder projects
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/projects/reorder" });

  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    log.warn("POST /api/projects/reorder - invalid body type");
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

  // Validate projectIds are unique non-empty strings
  const seen = new Set<string>();
  for (const id of projectIds) {
    if (typeof id !== "string" || id.trim() === "") {
      log.warn("POST /api/projects/reorder - invalid projectId");
      await log.flush();
      return NextResponse.json(
        { error: "projectIds must be non-empty strings" },
        { status: 400 }
      );
    }
    if (seen.has(id)) {
      log.warn("POST /api/projects/reorder - duplicate projectId");
      await log.flush();
      return NextResponse.json(
        { error: "projectIds must be unique" },
        { status: 400 }
      );
    }
    seen.add(id);
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
