/**
 * Vault Types (v3)
 *
 * Unified credential & identity manager types
 */

// ── Credential Type Union ──────────────────────────────────────────
export type VaultItemType =
  | 'api_key'
  | 'oauth_credential'
  | 'app_password'
  | 'login'
  | 'identity'
  | 'payment_card'
  | 'bank_account'
  | 'secure_note'
  | 'passport'
  | 'drivers_license'
  | 'ssn';

// ── Test Configuration ─────────────────────────────────────────────
export interface TestConfig {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  /** URL to test against — must be HTTPS */
  url: string;
  /** Headers to send — use $VALUE as placeholder for credential */
  headers?: Record<string, string>;
  /** Request body for POST/PUT — use $VALUE as placeholder */
  body?: string;
  /** Expected HTTP status code(s) */
  expectStatus: number | number[];
  /** Optional: expected response body contains */
  expectBodyContains?: string;
}

export interface TestResult {
  success: boolean;
  status: number;
  message: string;
  testedAt: string;
  durationMs: number;
}

// ── Status Enums ───────────────────────────────────────────────────
export type ExpiryStatus = 'ok' | 'warning' | 'expired' | 'none';
export type TestStatus = 'passed' | 'failed' | 'untested';

// ── Vault Item ─────────────────────────────────────────────────────
export interface VaultItem {
  /** UUID */
  id: string;
  /** Credential type */
  type: VaultItemType;
  /** Human-readable name */
  name: string;

  // ── Primary secret (api_key, app_password, login password, etc.) ──
  value?: string;

  // ── Common fields ──
  service?: string;
  username?: string;
  password?: string;
  url?: string;
  created?: string;
  expires?: string | null;
  tags?: string[];
  notes?: string;
  usedBy?: string[];

  // ── Test ──
  test?: TestConfig;
  lastTested?: string;
  lastTestResult?: 'pass' | 'fail';

  // ── Type-specific fields stored in `fields` ──
  fields?: Record<string, string | string[] | null | undefined>;
}

// ── Vault File (v3 on disk) ────────────────────────────────────────
export interface VaultFile {
  version: 3;
  items: VaultItem[];
}

// ── Masked Vault Item (API responses — no secrets) ─────────────────
export interface MaskedVaultItem {
  id: string;
  type: VaultItemType;
  name: string;

  service?: string;
  username?: string;
  url?: string;
  created?: string;
  expires?: string | null;
  tags?: string[];
  notes?: string;
  usedBy?: string[];

  test?: TestConfig;
  lastTested?: string;
  lastTestResult?: 'pass' | 'fail';

  /** Which secret-typed field keys have a value */
  hasValue: boolean;
  /** Type-specific non-secret fields (secret fields nulled out) */
  fields?: Record<string, string | string[] | null | undefined>;
  /** Keys of secret fields that have values */
  secretFieldKeys?: string[];
}

// ── Legacy v2 types (for migration) ────────────────────────────────
export interface LegacyCredential {
  value?: string;
  client_id?: string;
  client_secret?: string;
  url?: string;
  anon_key?: string;
  service_role_key?: string;
  auth_token?: string;
  type: string;
  service: string;
  account?: string;
  email?: string;
  scopes?: string[];
  project?: string;
  expires: string | null;
  created: string;
  used_by: string[];
  notes?: string;
  test?: TestConfig;
  lastTestResult?: TestResult;
  [key: string]: unknown;
}

export interface LegacySecretsFile {
  credentials: Record<string, LegacyCredential>;
  _meta: {
    version: number;
    updated: string;
    check_expiry_days_before: number;
  };
}
