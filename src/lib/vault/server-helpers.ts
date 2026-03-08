/**
 * Server-side vault helpers
 *
 * Shared utilities for reading/writing the vault file via the file server.
 */

import type { VaultFile, VaultItem, MaskedVaultItem, VaultItemType } from './types';
import { getSecretFieldKeys, CREDENTIAL_TYPES } from './schemas';
import { migrateV2toV3 } from './migrate';
import { getTestPreset } from './test-presets';

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

  // Track hash for optimistic locking on subsequent writes
  const encoder = new TextEncoder();
  const hashData = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  lastKnownHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const parsed = JSON.parse(content);

  // Check if already v3
  if (parsed && typeof parsed === 'object' && parsed.version === 3 && Array.isArray(parsed.items)) {
    const vault = parsed as VaultFile;
    // Auto-add test configs for items that match known presets but have no test config
    const enriched = autoEnrichTestConfigs(vault);
    if (enriched) {
      await writeVault(vault);
    }
    return vault;
  }

  // Migration needed — convert and persist immediately so IDs are stable
  const vault = migrateV2toV3(parsed);
  autoEnrichTestConfigs(vault);
  await writeVault(vault);
  return vault;
}

/**
 * Get the current hash of the vault file for optimistic locking.
 * Returns null if the file doesn't exist yet.
 */
async function getVaultHash(): Promise<string | null> {
  try {
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return null;
    const { content } = await res.json();
    // Simple hash via Web Crypto (SHA-256 hex)
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** In-memory lock hash for optimistic concurrency */
let lastKnownHash: string | null = null;

/**
 * Write the vault file back to the file server using atomic write pattern.
 *
 * 1. Compute hash of current file for optimistic locking
 * 2. Write to a temporary path first
 * 3. Rename (atomic on POSIX) to the final path
 *
 * If the file was modified since the last read, throws a conflict error
 * so the caller can re-read and retry.
 */
export async function writeVault(vault: VaultFile): Promise<void> {
  // Optimistic lock: check that the file hasn't changed since we last read it
  if (lastKnownHash !== null) {
    const currentHash = await getVaultHash();
    if (currentHash !== null && currentHash !== lastKnownHash) {
      throw new Error(
        'Vault file was modified by another process. Re-read and retry.',
      );
    }
  }

  const content = JSON.stringify(vault, null, 2);
  const tmpPath = SECRETS_PATH + '.tmp.' + Date.now();

  // Step 1: Write to temp file
  const writeRes = await fetch(`${FILE_SERVER_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: tmpPath, content }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!writeRes.ok) {
    throw new Error(`File server write (temp) returned ${writeRes.status}`);
  }

  // Step 2: Atomic rename temp → final
  const renameRes = await fetch(`${FILE_SERVER_URL}/files/rename`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: tmpPath, to: SECRETS_PATH }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!renameRes.ok) {
    // Attempt cleanup of temp file on failure
    await fetch(`${FILE_SERVER_URL}/files?path=${encodeURIComponent(tmpPath)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${FILE_SERVER_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
    throw new Error(`File server rename returned ${renameRes.status}`);
  }

  // Update optimistic lock hash after successful write
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  lastKnownHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Auto-enrich vault items with test configs from known presets.
 * Returns true if any items were enriched (vault needs to be persisted).
 */
function autoEnrichTestConfigs(vault: VaultFile): boolean {
  let changed = false;
  for (const item of vault.items) {
    // Only enrich testable types that don't already have a test config
    const schema = CREDENTIAL_TYPES[item.type];
    if (!schema?.testable || item.test) continue;

    const service = item.service?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
    if (!service) continue;

    const preset = getTestPreset(service);
    if (preset) {
      item.test = { ...preset.test };
      changed = true;
    }
  }
  return changed;
}

/**
 * Derive top-level `expires` from type-specific fields.
 *
 * - payment_card: fields.expiry (MM/YY) → last day of that month (YYYY-MM-DD)
 * - passport / drivers_license: fields.expiryDate (YYYY-MM-DD) → as-is
 */
export function deriveExpires(
  type: VaultItemType,
  fields: Record<string, string | string[] | null | undefined>,
): string | null {
  if (type === 'payment_card' && fields.expiry && typeof fields.expiry === 'string') {
    // Parse MM/YY format
    const match = fields.expiry.match(/^(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const month = parseInt(match[1], 10);
      let year = parseInt(match[2], 10);
      if (year < 100) year += 2000;
      // Last day of the expiry month
      const lastDay = new Date(year, month, 0).getDate();
      const mm = String(month).padStart(2, '0');
      const dd = String(lastDay).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  if ((type === 'passport' || type === 'drivers_license') && fields.expiryDate && typeof fields.expiryDate === 'string') {
    // Already in YYYY-MM-DD format
    return fields.expiryDate;
  }

  return null;
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
