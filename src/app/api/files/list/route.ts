/**
 * File List API Proxy
 * 
 * Server-side proxy for directory listing operations.
 * 
 * @module api/files/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/** External file server URL */
const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'https://files.skadauke.dev';
/** Bearer token for file server authentication (server-side only) */
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || '';

/**
 * GET /api/files/list?dir=<dirpath>
 * 
 * Lists files and directories in a given path.
 * 
 * @param request - Next.js request with dir query parameter
 * @returns JSON with files array and count or error
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dir = request.nextUrl.searchParams.get('dir');
  if (!dir) {
    return NextResponse.json({ error: 'Directory path is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${FILE_SERVER_URL}/files/list?dir=${encodeURIComponent(dir)}`, {
      headers: {
        'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json({ error: error.error || 'Failed to list directory' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Directory list error:', error);
    return NextResponse.json({ error: 'Failed to connect to file server' }, { status: 500 });
  }
}
