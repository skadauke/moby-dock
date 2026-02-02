import { NextRequest, NextResponse } from "next/server";
import { getAllProjects, createProject } from "@/lib/projects-store";

// GET /api/projects
export async function GET() {
  const result = await getAllProjects();
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}

// POST /api/projects
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { name, description, color } = body;
  
  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const result = await createProject({ name, description, color });
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
