import { NextRequest, NextResponse } from "next/server";
import { reorderTasks } from "@/lib/api-store";
import { Status } from "@/types/kanban";

// POST /api/tasks/reorder
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

  const { taskIds, status } = body;
  
  if (!Array.isArray(taskIds)) {
    return NextResponse.json(
      { error: "taskIds must be an array" },
      { status: 400 }
    );
  }

  if (!["BACKLOG", "READY", "DONE"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  const result = await reorderTasks(taskIds, status as Status);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}
