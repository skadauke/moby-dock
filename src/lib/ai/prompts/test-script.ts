/**
 * Test Script Prompt
 * 
 * Prompt template for generating credential test scripts.
 */

export interface CredentialInfo {
  id: string;
  type: string;
  service: string;
  notes?: string;
  account?: string;
  url?: string;
}

/**
 * Generate a prompt for creating a test script
 */
export function testScriptPrompt(credential: CredentialInfo): string {
  return `Generate a test script for this credential:

- ID: ${credential.id}
- Service: ${credential.service}
- Type: ${credential.type}
${credential.account ? `- Account: ${credential.account}` : ""}
${credential.url ? `- URL: ${credential.url}` : ""}
${credential.notes ? `- Notes: ${credential.notes}` : ""}

Requirements:
1. Use $VALUE as the placeholder for the secret value (it will be substituted at runtime)
2. The command should be a single shell command (curl, http, psql, etc.)
3. The command should complete quickly (under 10 seconds)
4. The command should NOT modify any data (read-only operations only)
5. The command should produce clear output that can be parsed

Examples for different credential types:

API Key:
- testCommand: curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $VALUE" https://api.openai.com/v1/models
- successIndicator: HTTP 200
- authFailureIndicator: HTTP 401

OAuth App (client credentials):
- testCommand: curl -s -X POST https://oauth.example.com/token -d "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$VALUE" -w "%{http_code}"
- successIndicator: HTTP 200 and access_token in response
- authFailureIndicator: HTTP 401 or invalid_client

Database Token:
- testCommand: curl -s -H "Authorization: Bearer $VALUE" "https://api.turso.tech/v1/organizations" -w "%{http_code}"
- successIndicator: HTTP 200
- authFailureIndicator: HTTP 401

GitHub PAT:
- testCommand: curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $VALUE" https://api.github.com/user
- successIndicator: HTTP 200
- authFailureIndicator: HTTP 401

Generate a test script appropriate for this specific credential.`;
}

/**
 * System prompt for test script generation
 */
export const TEST_SCRIPT_SYSTEM_PROMPT = `You are a DevOps expert specializing in credential validation.

Your task is to generate shell commands that test whether credentials are valid.

Rules:
- Always use $VALUE as the placeholder for secret values
- Commands must be read-only (no mutations)
- Commands must complete quickly (under 10 seconds)
- Commands must produce parseable output
- Be specific about what indicates success vs auth failure vs other errors

Return valid JSON only. No markdown, no explanation outside the JSON.`;
