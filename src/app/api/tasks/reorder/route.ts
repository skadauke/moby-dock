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

  // Accept both READY and IN_PROGRESS (legacy DB value)
  const validStatuses = ["BACKLOG", "READY", "IN_PROGRESS", "DONE"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  // Map IN_PROGRESS to READY (DB compatibility)
  const mappedStatus = status === "IN_PROGRESS" ? "READY" : status;
  const result = await reorderTasks(taskIds, mappedStatus as Status);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}
