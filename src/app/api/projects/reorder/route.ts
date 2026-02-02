import { NextRequest, NextResponse } from "next/server";
import { reorderProjects } from "@/lib/projects-store";

// POST /api/projects/reorder
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

  const { projectIds } = body;
  
  if (!Array.isArray(projectIds)) {
    return NextResponse.json(
      { error: "projectIds must be an array" },
      { status: 400 }
    );
  }

  const result = await reorderProjects(projectIds);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json({ success: true });
}
