/**
 * Quick Access Reorder Route
 *
 * Handles reordering of quick access items via drag-and-drop.
 *
 * @module api/quick-access/reorder
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { reorderQuickAccessItems } from "@/lib/quick-access-store";

/**
 * POST /api/quick-access/reorder
 * Reorder quick access items
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/quick-access/reorder" });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    log.warn("POST /api/quick-access/reorder - unauthorized");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("POST /api/quick-access/reorder - invalid JSON", {
      userId: session.user.id,
    });
    await log.flush();
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { itemIds } = body;

  if (!Array.isArray(itemIds)) {
    log.warn("POST /api/quick-access/reorder - itemIds not array", {
      userId: session.user.id,
    });
    await log.flush();
    return NextResponse.json({ error: "itemIds must be an array" }, { status: 400 });
  }

  log.info("POST /api/quick-access/reorder", {
    userId: session.user.id,
    itemCount: itemIds.length,
  });

  const startTime = Date.now();
  const result = await reorderQuickAccessItems(session.user.id, itemIds);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] reorderQuickAccessItems failed", {
      userId: session.user.id,
      itemCount: itemIds.length,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  log.info("[Supabase] reorderQuickAccessItems success", {
    userId: session.user.id,
    itemCount: itemIds.length,
    duration,
  });
  await log.flush();

  return NextResponse.json({ success: true });
}
