/**
 * Project Detail API Routes
 *
 * Single project operations: get, update, delete.
 *
 * @module api/projects/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";
import { getProjectById, updateProject, deleteProject } from "@/lib/projects-store";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]
 * Get a single project by ID
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/projects/[id]" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized project read attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  log.info("GET /api/projects/[id]", { projectId: id, userId: authResult.userId });

  const startTime = Date.now();
  const result = await getProjectById(id);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.warn("[Supabase] getProjectById failed", {
      projectId: id,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] getProjectById success", { projectId: id, duration });
  await log.flush();

  return NextResponse.json(result.data);
}

/**
 * PATCH /api/projects/[id]
 * Update a project
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/projects/[id]" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized project update attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("PATCH /api/projects/[id] - invalid JSON", { projectId: id });
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    log.warn("PATCH /api/projects/[id] - invalid body type", { projectId: id });
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updatedFields = Object.keys(body);
  log.info("PATCH /api/projects/[id]", { projectId: id, updatedFields });

  const startTime = Date.now();
  const result = await updateProject(id, body);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] updateProject failed", {
      projectId: id,
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

  log.info("[Supabase] updateProject success", {
    projectId: id,
    updatedFields,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data);
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const log = new Logger({ source: "api/projects/[id]" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized project delete attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;

  log.info("DELETE /api/projects/[id]", { projectId: id, userId: authResult.userId });

  const startTime = Date.now();
  const result = await deleteProject(id);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] deleteProject failed", {
      projectId: id,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] deleteProject success", { projectId: id, duration });
  await log.flush();

  return NextResponse.json({ success: true });
}
