/**
 * GET    /api/vault/items/[id] — Get single item (masked)
 * PUT    /api/vault/items/[id] — Update item
 * DELETE /api/vault/items/[id] — Delete item
 */

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { readVault, writeVault, maskItem } from '@/lib/vault/server-helpers';

type Params = { params: Promise<{ id: string }> };

// ── GET ────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new Logger({ source: 'api/vault/items/[id]' });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vault = await readVault();
    const item = vault.items.find((i) => i.id === id);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await log.flush();
    return NextResponse.json({ item: maskItem(item) });
  } catch (error) {
    log.error('Failed to get vault item', { id, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to read vault' }, { status: 500 });
  }
}

// ── PUT ────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new Logger({ source: 'api/vault/items/[id]' });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const vault = await readVault();
    const idx = vault.items.findIndex((i) => i.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = vault.items[idx];

    // Merge update — keep id and type immutable
    const updated = {
      ...existing,
      name: body.name ?? existing.name,
      value: body.value !== undefined ? body.value : existing.value,
      service: body.service !== undefined ? body.service : existing.service,
      username: body.username !== undefined ? body.username : existing.username,
      password: body.password !== undefined ? body.password : existing.password,
      url: body.url !== undefined ? body.url : existing.url,
      expires: body.expires !== undefined ? body.expires : existing.expires,
      tags: body.tags !== undefined ? body.tags : existing.tags,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      usedBy: body.usedBy !== undefined ? body.usedBy : existing.usedBy,
      test: body.test !== undefined ? body.test : existing.test,
      fields: body.fields !== undefined
        ? { ...existing.fields, ...body.fields }
        : existing.fields,
    };

    vault.items[idx] = updated;
    await writeVault(vault);

    log.info('Updated vault item', { id });
    await log.flush();

    return NextResponse.json({ item: maskItem(updated) });
  } catch (error) {
    log.error('Failed to update vault item', { id, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new Logger({ source: 'api/vault/items/[id]' });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vault = await readVault();
    const idx = vault.items.findIndex((i) => i.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    vault.items.splice(idx, 1);
    await writeVault(vault);

    log.info('Deleted vault item', { id });
    await log.flush();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete vault item', { id, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
