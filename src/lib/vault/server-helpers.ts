/**
 * Server-side vault helpers
 *
 * Shared utilities for reading/writing the vault file via the file server.
 */

import type { VaultFile, VaultItem, MaskedVaultItem, VaultItemType } from './types';
import { getSecretFieldKeys, CREDENTIAL_TYPES } from './schemas';
import { migrateV2toV3 } from './migrate';

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4001';
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || '';
const SECRETS_PATH = '~/.openclaw/credentials/secrets.json';

/**
 * Read the vault file from the file server, migrating v2 → v3 if needed.
 * If migration occurs, the v3 format is persisted back to disk immediately
 * so that UUIDs remain stable across reads.
 */
export async function readVault(): Promise<VaultFile> {
  const res = await fetch(
    `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
    {
      headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    throw new Error(`File server returned ${res.status}`);
  }

  const { content } = await res.json();
  const parsed = JSON.parse(content);

  // Check if already v3
  if (parsed && typeof parsed === 'object' && parsed.version === 3 && Array.isArray(parsed.items)) {
    return parsed as VaultFile;
  }

  // Migration needed — convert and persist immediately so IDs are stable
  const vault = migrateV2toV3(parsed);
  await writeVault(vault);
  return vault;
}

/**
 * Write the vault file back to the file server.
 */
export async function writeVault(vault: VaultFile): Promise<void> {
  const res = await fetch(`${FILE_SERVER_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: SECRETS_PATH,
      content: JSON.stringify(vault, null, 2),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`File server write returned ${res.status}`);
  }
}

/**
 * Mask a VaultItem — strip secret field values.
 */
export function maskItem(item: VaultItem): MaskedVaultItem {
  const secretKeys = getSecretFieldKeys(item.type);
  // Top-level secret-like keys
  const topSecretKeys = new Set(['value', 'password']);

  const masked: MaskedVaultItem = {
    id: item.id,
    type: item.type,
    name: item.name,
    service: item.service,
    username: item.username,
    url: item.url,
    created: item.created,
    expires: item.expires,
    tags: item.tags,
    notes: item.notes,
    usedBy: item.usedBy,
    test: item.test,
    lastTested: item.lastTested,
    lastTestResult: item.lastTestResult,
    hasValue: !!item.value,
    secretFieldKeys: [],
  };

  // Track which top-level secret keys have values
  if (item.value) masked.secretFieldKeys!.push('value');
  if (item.password) masked.secretFieldKeys!.push('password');

  // Mask fields object
  if (item.fields) {
    const maskedFields: Record<string, string | string[] | null | undefined> = {};
    for (const [k, v] of Object.entries(item.fields)) {
      if (secretKeys.has(k)) {
        maskedFields[k] = null;
        if (v) masked.secretFieldKeys!.push(k);
      } else {
        maskedFields[k] = v;
      }
    }
    masked.fields = maskedFields;
  }

  return masked;
}

/**
 * Proxy a test request to the file server's /credentials/test endpoint.
 */
export async function proxyTest(
  testConfig: NonNullable<VaultItem['test']>,
  value: string,
): Promise<{ success: boolean; status: number; message: string; testedAt: string; durationMs: number }> {
  const res = await fetch(`${FILE_SERVER_URL}/credentials/test`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ test: testConfig, value }),
    signal: AbortSignal.timeout(40_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Test proxy returned ${res.status}: ${body}`);
  }

  return res.json();
}
