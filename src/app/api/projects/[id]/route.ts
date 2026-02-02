import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProject, deleteProject } from "@/lib/projects-store";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await getProjectById(id);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}

// PATCH /api/projects/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const result = await updateProject(id, body);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}

// DELETE /api/projects/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await deleteProject(id);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json({ success: true });
}
