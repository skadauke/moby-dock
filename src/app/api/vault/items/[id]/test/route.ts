/**
 * POST /api/vault/items/[id]/test — Test a credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { readVault, writeVault, proxyTest } from '@/lib/vault/server-helpers';
import { CREDENTIAL_TYPES } from '@/lib/vault/schemas';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new Logger({ source: 'api/vault/items/[id]/test' });
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

    const schema = CREDENTIAL_TYPES[item.type];
    if (!schema?.testable) {
      return NextResponse.json({ error: 'This item type is not testable' }, { status: 400 });
    }

    if (!item.test) {
      return NextResponse.json(
        { error: 'No test configuration', needsGeneration: true },
        { status: 400 },
      );
    }

    // Determine the value to test with
    let testValue = item.value;

    // For OAuth credentials, fall back to accessToken if top-level value is empty
    if (!testValue && item.type === 'oauth_credential') {
      testValue = (item.fields?.accessToken as string) || undefined;
    }

    if (!testValue) {
      return NextResponse.json({ error: 'Credential has no value to test' }, { status: 400 });
    }

    // Proxy the test to the file server
    const result = await proxyTest(item.test, testValue);

    // Save result back
    item.lastTested = result.testedAt;
    item.lastTestResult = result.success ? 'pass' : 'fail';
    await writeVault(vault);

    log.info('Test completed', { id, success: result.success, durationMs: result.durationMs });
    await log.flush();

    return NextResponse.json({ result });
  } catch (error) {
    log.error('Test failed', { id, error: String(error) });
    await log.flush();
    return NextResponse.json({ error: 'Test execution failed' }, { status: 500 });
  }
}
