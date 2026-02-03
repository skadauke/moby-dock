import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getQuickAccessItems,
  addQuickAccessItem,
  initializeDefaultQuickAccess,
} from "@/lib/quick-access-store";

const HOME = process.env.HOME_DIR || "/Users/skadauke";

/**
 * GET /api/quick-access
 * Get all quick access items for the current user
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getQuickAccessItems(session.user.id);
  
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // If user has no items, initialize with defaults
  if (result.data.length === 0) {
    const initResult = await initializeDefaultQuickAccess(session.user.id, HOME);
    if (!initResult.ok) {
      return NextResponse.json({ error: initResult.error.message }, { status: 500 });
    }
    return NextResponse.json(initResult.data);
  }

  return NextResponse.json(result.data);
}

/**
 * POST /api/quick-access
 * Add a new quick access item
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { filePath, fileName, description } = body;

    if (!filePath || !fileName) {
      return NextResponse.json(
        { error: "filePath and fileName are required" },
        { status: 400 }
      );
    }

    const result = await addQuickAccessItem(
      session.user.id,
      filePath,
      fileName,
      description
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
