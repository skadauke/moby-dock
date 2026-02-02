import { NextRequest, NextResponse } from "next/server";
import { toggleTaskFlag } from "@/lib/api-store";

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/tasks/[id]/flag - Toggle needs_review flag
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await toggleTaskFlag(id);
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.httpStatus }
    );
  }

  return NextResponse.json(result.data);
}
