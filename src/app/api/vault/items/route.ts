/**
 * GET /api/vault/items  — List all items (masked)
 * POST /api/vault/items — Create a new item
 */

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';
import { readVault, writeVault, maskItem } from '@/lib/vault/server-helpers';
import type { VaultItem, VaultItemType } from '@/lib/vault/types';
import { CREDENTIAL_TYPES } from '@/lib/vault/schemas';
import { deriveExpires } from '@/lib/vault/server-helpers';

// ── GET ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const log = new Logger({ source: 'api/vault/items' });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vault = await readVault();
    let items = vault.items;

    // Filters
    const sp = request.nextUrl.searchParams;
    const category = sp.get('category');
    const type = sp.get('type');
    const search = sp.get('search')?.toLowerCase();
    const tag = sp.get('tag');

    if (category) {
      const typesInCat = (Object.keys(CREDENTIAL_TYPES) as VaultItemType[]).filter(
        (t) => CREDENTIAL_TYPES[t].category === category,
      );
      items = items.filter((i) => typesInCat.includes(i.type));
    }

    if (type) {
      items = items.filter((i) => i.type === type);
    }

    if (search) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          (i.service && i.service.toLowerCase().includes(search)) ||
          (i.notes && i.notes.toLowerCase().includes(search)) ||
          (i.tags && i.tags.some((t) => t.toLowerCase().includes(search))),
      );
    }

    if (tag) {
      items = items.filter((i) => i.tags?.includes(tag));
    }

    const masked = items.map(maskItem);

    log.info('GET /api/vault/items', { count: masked.length });
    await log.flush();

    return NextResponse.json({ items: masked });
  } catch (error) {
    log.error('Failed to list vault items', { error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to read vault' }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const log = new Logger({ source: 'api/vault/items' });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    await log.flush();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate type
    if (!body.type || !(body.type in CREDENTIAL_TYPES)) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
    }
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const vault = await readVault();

    const itemType = body.type as VaultItemType;
    const itemFields = body.fields || {};

    // Derive top-level expires from type-specific fields if not explicitly provided
    const expires = body.expires ?? deriveExpires(itemType, itemFields) ?? null;

    const newItem: VaultItem = {
      id: randomUUID(),
      type: itemType,
      name: body.name,
      value: body.value,
      service: body.service,
      username: body.username,
      password: body.password,
      url: body.url,
      created: body.created || new Date().toISOString().split('T')[0],
      expires,
      tags: body.tags || [],
      notes: body.notes,
      usedBy: body.usedBy || [],
      test: body.test,
      fields: itemFields,
    };

    vault.items.push(newItem);
    await writeVault(vault);

    log.info('Created vault item', { id: newItem.id, type: newItem.type });
    await log.flush();

    return NextResponse.json({ item: maskItem(newItem) }, { status: 201 });
  } catch (error) {
    log.error('Failed to create vault item', { error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
