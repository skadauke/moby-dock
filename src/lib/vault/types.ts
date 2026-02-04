/**
 * Vault Types
 * 
 * Shared types for credential management
 */

/**
 * Structured test configuration for credential verification
 * This is safer than storing arbitrary shell commands
 */
export interface TestConfig {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  /** URL to test against - must be HTTPS */
  url: string;
  /** Headers to send - use $VALUE as placeholder for credential */
  headers?: Record<string, string>;
  /** Request body for POST/PUT - use $VALUE as placeholder */
  body?: string;
  /** Expected HTTP status code(s) */
  expectStatus: number | number[];
  /** Optional: expected response body contains */
  expectBodyContains?: string;
}

/**
 * Test execution result
 */
export interface TestResult {
  success: boolean;
  status: number;
  message: string;
  testedAt: string;
  durationMs: number;
}

/**
 * Credential stored in secrets.json
 */
export interface Credential {
  /** Primary secret value (API key, token, password) */
  value?: string;
  /** OAuth client ID */
  client_id?: string;
  /** OAuth client secret */
  client_secret?: string;
  /** Service URL */
  url?: string;
  /** Supabase anon key */
  anon_key?: string;
  /** Supabase service role key */
  service_role_key?: string;
  /** Generic auth token */
  auth_token?: string;
  /** Credential type (api_key, pat, oauth_app, bot_token, etc.) */
  type: string;
  /** Service name (GitHub, OpenAI, etc.) */
  service: string;
  /** Account/username associated with credential */
  account?: string;
  /** Email associated with credential */
  email?: string;
  /** OAuth scopes */
  scopes?: string[];
  /** Project name */
  project?: string;
  /** Expiration date (ISO string) or null if no expiry */
  expires: string | null;
  /** Creation date (ISO string) */
  created: string;
  /** Files/projects using this credential */
  used_by: string[];
  /** Human-readable notes */
  notes?: string;
  /** Test configuration for verification */
  test?: TestConfig;
  /** Last test result */
  lastTestResult?: TestResult;
}

/**
 * Full secrets.json file structure
 */
export interface SecretsFile {
  credentials: Record<string, Credential>;
  _meta: {
    version: number;
    updated: string;
    check_expiry_days_before: number;
  };
}

/**
 * Masked credential for API responses (no secret values)
 */
export interface MaskedCredential {
  id: string;
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
  hasValue: boolean;
  hasClientCredentials: boolean;
  hasTest: boolean;
  lastTestResult?: TestResult;
}
