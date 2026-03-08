/**
 * POST /api/vault/items/[id]/reveal — Return actual secret values for one item
 */

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { readVault } from '@/lib/vault/server-helpers';
import { getSecretFieldKeys } from '@/lib/vault/schemas';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new Logger({ source: 'api/vault/items/[id]/reveal' });
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

    const secretKeys = getSecretFieldKeys(item.type);

    // Build a secrets-only response
    const secrets: Record<string, string | undefined> = {};

    // Top-level secrets
    if (item.value) secrets.value = item.value;
    if (item.password) secrets.password = item.password;

    // Fields-level secrets
    if (item.fields) {
      for (const [k, v] of Object.entries(item.fields)) {
        if (secretKeys.has(k) && v && typeof v === 'string') {
          secrets[k] = v;
        }
      }
    }

    log.info('Revealed vault item secrets', { id, keyCount: Object.keys(secrets).length });
    await log.flush();

    return NextResponse.json({ secrets });
  } catch (error) {
    log.error('Failed to reveal vault item', { id, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Failed to reveal secrets' }, { status: 500 });
  }
}
