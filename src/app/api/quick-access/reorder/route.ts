import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reorderQuickAccessItems } from "@/lib/quick-access-store";

/**
 * POST /api/quick-access/reorder
 * Reorder quick access items
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { itemIds } = body;

    if (!Array.isArray(itemIds)) {
      return NextResponse.json(
        { error: "itemIds must be an array" },
        { status: 400 }
      );
    }

    const result = await reorderQuickAccessItems(session.user.id, itemIds);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
