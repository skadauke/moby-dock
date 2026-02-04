/**
 * Quick Access Item Delete Route
 *
 * Handles deletion of individual quick access items.
 *
 * @module api/quick-access/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { removeQuickAccessItem } from "@/lib/quick-access-store";

/**
 * DELETE /api/quick-access/[id]
 * Remove a quick access item
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = new Logger({ source: "api/quick-access/[id]" });
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    log.warn("DELETE /api/quick-access/[id] - unauthorized", { itemId: id });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("DELETE /api/quick-access/[id]", {
    itemId: id,
    userId: session.user.id,
  });

  const startTime = Date.now();
  const result = await removeQuickAccessItem(id, session.user.id);
  const duration = Date.now() - startTime;

  if (!result.ok) {
    log.error("[Supabase] removeQuickAccessItem failed", {
      itemId: id,
      userId: session.user.id,
      error: result.error.message,
      duration,
    });
    await log.flush();
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  log.info("[Supabase] removeQuickAccessItem success", {
    itemId: id,
    userId: session.user.id,
    duration,
  });
  await log.flush();

  return NextResponse.json({ success: true });
}
