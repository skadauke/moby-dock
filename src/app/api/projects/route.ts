/**
 * Projects API Routes
 *
 * CRUD operations for projects in the Command section.
 *
 * @module api/projects
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { checkApiAuth } from "@/lib/api-auth";
import { getAllProjects, createProject } from "@/lib/projects-store";

/**
 * GET /api/projects
 * List all projects
 */
export async function GET() {
  const log = new Logger({ source: "api/projects" });
  
  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized projects list attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  log.info("GET /api/projects", { userId: authResult.userId });

  const startTime = Date.now();
  const result = await getAllProjects();
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] getAllProjects failed", {
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] getAllProjects success", {
    count: result.data.length,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data);
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/projects" });

  // Auth check (session or Bearer token)
  const authResult = await checkApiAuth();
  if (!authResult.authenticated) {
    log.warn("Unauthorized project create attempt");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("POST /api/projects - invalid JSON");
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    log.warn("POST /api/projects - invalid body type");
    await log.flush();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description, color } = body;

  if (!name || typeof name !== "string") {
    log.warn("POST /api/projects - missing name");
    await log.flush();
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  log.info("POST /api/projects", { name, color });

  const startTime = Date.now();
  const result = await createProject({ name, description, color });
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] createProject failed", {
      name,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  log.info("[Supabase] createProject success", {
    projectId: result.data.id,
    name,
    duration,
  });
  await log.flush();

  return NextResponse.json(result.data, { status: 201 });
}
