/**
 * File API Proxy Routes
 * 
 * Server-side proxy for file operations. Keeps the file server token secure
 * by never exposing it to the client. All requests require authentication.
 * 
 * @module api/files
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { Logger } from 'next-axiom';

/** External file server URL */
const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'https://files.skadauke.dev';
/** Bearer token for file server authentication (server-side only) */
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || '';

/**
 * GET /api/files?path=<filepath>
 * 
 * Reads a file from the file server. Returns file content, size, and modification time.
 * 
 * @param request - Next.js request with path query parameter
 * @returns JSON with content, modifiedAt, and size or error
 */
export async function GET(request: NextRequest) {
  const log = new Logger({ source: 'api/files' });
  const path = request.nextUrl.searchParams.get('path');
  
  log.info('GET /api/files', { path });

  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn('Unauthorized file read attempt', { path });
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!path) {
    log.warn('Missing path parameter');
    await log.flush();
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  try {
    const startTime = Date.now();
    const res = await fetch(`${FILE_SERVER_URL}/files?path=${encodeURIComponent(path)}`, {
      headers: {
        'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    const duration = Date.now() - startTime;

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      log.error('File server error', { path, status: res.status, error: error.error, duration });
      await log.flush();
      return NextResponse.json({ error: error.error || 'Failed to read file' }, { status: res.status });
    }

    const data = await res.json();
    log.info('File read success', { path, size: data.size, duration });
    await log.flush();
    return NextResponse.json(data);
  } catch (error) {
    log.error('File server connection failed', { path, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to connect to file server' }, { status: 500 });
  }
}

/**
 * POST /api/files
 * 
 * Writes content to a file on the file server.
 * 
 * @param request - Next.js request with JSON body containing path and content
 * @returns JSON with success status or error
 */
export async function POST(request: NextRequest) {
  const log = new Logger({ source: 'api/files' });
  
  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn('Unauthorized file write attempt');
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { path?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    log.warn('Invalid JSON body in POST');
    await log.flush();
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { path, content } = body;
  log.info('POST /api/files', { path, contentLength: content?.length });

  try {
    if (!path || content === undefined) {
      log.warn('Missing path or content');
      await log.flush();
      return NextResponse.json({ error: 'Path and content are required' }, { status: 400 });
    }

    const startTime = Date.now();
    const res = await fetch(`${FILE_SERVER_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, content }),
    });
    const duration = Date.now() - startTime;

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      log.error('File server write error', { path, status: res.status, error: error.error, duration });
      await log.flush();
      return NextResponse.json({ error: error.error || 'Failed to write file' }, { status: res.status });
    }

    log.info('File write success', { path, contentLength: content.length, duration });
    await log.flush();
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('File server connection failed on write', { path, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to connect to file server' }, { status: 500 });
  }
}

/**
 * DELETE /api/files?path=<filepath>
 * 
 * Deletes a file from the file server.
 * 
 * @param request - Next.js request with path query parameter
 * @returns JSON with success status or error
 */
export async function DELETE(request: NextRequest) {
  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${FILE_SERVER_URL}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json({ error: error.error || 'Failed to delete file' }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('File delete error:', error);
    return NextResponse.json({ error: 'Failed to connect to file server' }, { status: 500 });
  }
}
