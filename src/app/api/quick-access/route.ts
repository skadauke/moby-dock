/**
 * Quick Access API Routes
 * 
 * Manages user's quick access file shortcuts. Supports listing and adding items.
 * Items are persisted per-user in Supabase.
 * 
 * @module api/quick-access
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Logger } from "next-axiom";
import {
  getQuickAccessItems,
  addQuickAccessItem,
  initializeDefaultQuickAccess,
} from "@/lib/quick-access-store";

/** Home directory for default quick access paths (from env or system) */
const HOME = process.env.HOME_DIR ?? process.env.HOME;

/**
 * GET /api/quick-access
 * Get all quick access items for the current user
 */
export async function GET() {
  const log = new Logger({ source: 'api/quick-access' });
  log.info('GET /api/quick-access');

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    log.warn('Unauthorized quick-access request');
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const result = await getQuickAccessItems(session.user.id);
  const duration = Date.now() - startTime;
  
  if (!result.ok) {
    log.error('Supabase quick-access query failed', { error: result.error.message, duration });
    await log.flush();
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // If user has no items, initialize with defaults
  if (result.data.length === 0) {
    log.info('Initializing default quick-access items', { userId: session.user.id });
    if (!HOME) {
      log.error('HOME_DIR not configured');
      await log.flush();
      return NextResponse.json(
        { error: "HOME_DIR is not configured" },
        { status: 500 }
      );
    }
    const initResult = await initializeDefaultQuickAccess(session.user.id, HOME);
    if (!initResult.ok) {
      log.error('Failed to initialize quick-access', { error: initResult.error.message });
      await log.flush();
      return NextResponse.json({ error: initResult.error.message }, { status: 500 });
    }
    log.info('Quick-access initialized', { count: initResult.data.length, duration: Date.now() - startTime });
    await log.flush();
    return NextResponse.json(initResult.data);
  }

  log.info('Quick-access loaded', { count: result.data.length, duration });
  await log.flush();
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
