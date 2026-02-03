import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'https://files.skadauke.dev';
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || '';

// Proxy GET requests to file server (read file)
export async function GET(request: NextRequest) {
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
      headers: {
        'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json({ error: error.error || 'Failed to read file' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('File read error:', error);
    return NextResponse.json({ error: 'Failed to connect to file server' }, { status: 500 });
  }
}

// Proxy POST requests to file server (write file)
export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { path, content } = body;

    if (!path || content === undefined) {
      return NextResponse.json({ error: 'Path and content are required' }, { status: 400 });
    }

    const res = await fetch(`${FILE_SERVER_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FILE_SERVER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, content }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json({ error: error.error || 'Failed to write file' }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('File write error:', error);
    return NextResponse.json({ error: 'Failed to connect to file server' }, { status: 500 });
  }
}

// Proxy DELETE requests to file server
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
