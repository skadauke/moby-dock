import { NextRequest, NextResponse } from "next/server";
import { getTaskById, updateTask, deleteTask } from "@/lib/api-store";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await getTaskById(id);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}

// PATCH /api/tasks/[id]
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

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const result = await updateTask(id, body);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}

// DELETE /api/tasks/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await deleteTask(id);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json({ success: true });
}
