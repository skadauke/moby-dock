/**
 * Test Config Prompt
 * 
 * Prompts for AI-generated structured test configurations
 */

export interface CredentialInfo {
  id: string;
  type: string;
  service: string;
  account?: string;
  notes?: string;
  scopes?: string[];
}

/**
 * System prompt for test config generation
 */
export const TEST_CONFIG_SYSTEM_PROMPT = `You are an API expert that generates test configurations for credential verification.

Your job is to create a structured HTTP test that verifies a credential is valid and working.

RULES:
1. Use $VALUE as the placeholder for the credential value
2. Always use HTTPS URLs
3. Use the service's official API endpoint
4. Choose an endpoint that:
   - Requires authentication (to actually test the credential)
   - Is lightweight/fast (avoid heavy data endpoints)
   - Is read-only when possible (GET preferred)
   - Returns quickly (user info, account status, etc.)
5. Common patterns:
   - API keys: Usually "Authorization: Bearer $VALUE" or "X-Api-Key: $VALUE"
   - PATs (Personal Access Tokens): "Authorization: token $VALUE" or "Authorization: Bearer $VALUE"
   - OAuth: "Authorization: Bearer $VALUE"
   - Basic auth: "Authorization: Basic $VALUE" (if value is already base64 encoded)

EXAMPLES:

GitHub PAT:
{
  "method": "GET",
  "url": "https://api.github.com/user",
  "headers": { "Authorization": "token $VALUE", "User-Agent": "credential-test" },
  "expectStatus": 200,
  "description": "Fetches authenticated user profile",
  "notes": "Requires 'read:user' scope for full profile"
}

OpenAI API Key:
{
  "method": "GET",
  "url": "https://api.openai.com/v1/models",
  "headers": { "Authorization": "Bearer $VALUE" },
  "expectStatus": 200,
  "description": "Lists available models",
  "notes": "Minimal API call to verify key validity"
}

Vercel Token:
{
  "method": "GET",
  "url": "https://api.vercel.com/v2/user",
  "headers": { "Authorization": "Bearer $VALUE" },
  "expectStatus": 200,
  "description": "Fetches authenticated user info",
  "notes": "Works with any valid Vercel token"
}

Supabase Service Role Key:
{
  "method": "GET",
  "url": "https://[project-ref].supabase.co/rest/v1/",
  "headers": { 
    "apikey": "$VALUE",
    "Authorization": "Bearer $VALUE"
  },
  "expectStatus": 200,
  "description": "Lists available tables",
  "notes": "Requires project URL to be known"
}`;

/**
 * Build user prompt for test config generation
 */
export function testConfigPrompt(credential: CredentialInfo): string {
  const parts = [
    'Generate a test configuration for this credential:',
    '',
    `- ID: ${credential.id}`,
    `- Type: ${credential.type}`,
    `- Service: ${credential.service}`,
  ];
  
  if (credential.account) {
    parts.push(`- Account: ${credential.account}`);
  }
  
  if (credential.scopes?.length) {
    parts.push(`- Scopes: ${credential.scopes.join(', ')}`);
  }
  
  if (credential.notes) {
    parts.push(`- Notes: ${credential.notes}`);
  }
  
  parts.push('');
  parts.push('Generate a structured test config that will verify this credential is valid.');
  parts.push('Use $VALUE as the placeholder for the credential value.');
  
  return parts.join('\n');
}
