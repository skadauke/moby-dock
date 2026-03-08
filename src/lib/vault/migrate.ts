/**
 * Vault Migration — v2 → v3
 *
 * Converts the legacy flat Record<string, Credential> format
 * into the v3 items-array format with UUIDs.
 */

import { randomUUID } from 'crypto';
import type { VaultFile, VaultItem, VaultItemType } from './types';

/** Map legacy type strings → v3 VaultItemType */
const TYPE_MAP: Record<string, VaultItemType> = {
  api_key: 'api_key',
  api_token: 'api_key',
  access_token: 'api_key',
  pat: 'api_key',
  bot_token: 'api_key',
  database_token: 'api_key',
  secret: 'api_key',
  oauth_app: 'oauth_credential',
  app_password: 'app_password',
  login: 'login',
};

/** Convert a snake_case key name into a human-readable Name */
function keyToName(key: string): string {
  return key
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Migrate a v2 secrets file to v3.
 * If data is already v3, returns it as-is.
 */
export function migrateV2toV3(data: unknown): VaultFile {
  if (!data || typeof data !== 'object') {
    return { version: 3, items: [] };
  }

  const obj = data as Record<string, unknown>;

  // Already v3
  if (obj.version === 3 && Array.isArray(obj.items)) {
    return data as VaultFile;
  }

  // Expect v2 shape
  const credentials = obj.credentials as Record<string, Record<string, unknown>> | undefined;
  if (!credentials || typeof credentials !== 'object') {
    return { version: 3, items: [] };
  }

  const items: VaultItem[] = Object.entries(credentials).map(([key, cred]) => {
    const legacyType = (cred.type as string) || 'api_key';
    const mappedType: VaultItemType = TYPE_MAP[legacyType] || 'api_key';

    const item: VaultItem = {
      id: randomUUID(),
      type: mappedType,
      name: keyToName(key),
      created: (cred.created as string) || new Date().toISOString().split('T')[0],
      expires: (cred.expires as string | null) ?? null,
      tags: [],
      usedBy: (cred.used_by as string[]) || [],
      notes: (cred.notes as string) || undefined,
    };

    // Primary value
    if (cred.value) item.value = cred.value as string;
    if (cred.service) item.service = cred.service as string;
    if (cred.account) item.username = cred.account as string;
    if (cred.url) item.url = cred.url as string;

    // Test config
    if (cred.test) item.test = cred.test as VaultItem['test'];
    if (cred.lastTestResult && typeof cred.lastTestResult === 'object') {
      const tr = cred.lastTestResult as Record<string, unknown>;
      item.lastTested = (tr.testedAt as string) || undefined;
      item.lastTestResult = (tr.success as boolean) ? 'pass' : 'fail';
    }

    // Build `fields` for extra data that doesn't map to top-level VaultItem keys
    const fields: Record<string, string | string[] | null | undefined> = {};

    // OAuth-specific
    if (mappedType === 'oauth_credential') {
      if (cred.client_id) fields.clientId = cred.client_id as string;
      if (cred.client_secret) fields.clientSecret = cred.client_secret as string;
      if (cred.scopes) fields.scope = (cred.scopes as string[]).join(', ');
    }

    // Extra fields that don't have a home at the top level
    if (cred.anon_key) fields.anonKey = cred.anon_key as string;
    if (cred.service_role_key) fields.serviceRoleKey = cred.service_role_key as string;
    if (cred.auth_token) {
      // Treat auth_token as the primary value if no value is set
      if (!item.value) item.value = cred.auth_token as string;
      else fields.authToken = cred.auth_token as string;
    }
    if (cred.email) fields.email = cred.email as string;
    if (cred.project) fields.project = cred.project as string;
    if (cred.scopes && mappedType !== 'oauth_credential') {
      fields.scope = (cred.scopes as string[]).join(', ');
    }
    // Extra non-standard keys
    if (cred.bot_name) fields.botName = cred.bot_name as string;
    if (cred.chat_id) fields.chatId = cred.chat_id as string;
    if (cred.watch_address) fields.watchAddress = cred.watch_address as string;

    if (Object.keys(fields).length > 0) {
      item.fields = fields;
    }

    return item;
  });

  return { version: 3, items };
}
