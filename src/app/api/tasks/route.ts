import { NextRequest, NextResponse } from "next/server";
import { getAllTasks, createTask } from "@/lib/api-store";

// GET /api/tasks - List all tasks
export async function GET() {
  const result = await getAllTasks();
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}

// POST /api/tasks - Create new task
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

  const { title, description, priority, creator, projectId } = body;
  
  if (!title || typeof title !== "string") {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  const result = await createTask({
    title,
    description,
    priority,
    creator,
    projectId,
  });
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
