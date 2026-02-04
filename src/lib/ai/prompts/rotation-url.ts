/**
 * Rotation URL Prompt
 * 
 * Prompt template for generating credential rotation information.
 */

export interface CredentialInfo {
  id: string;
  type: string;
  service: string;
  notes?: string;
  account?: string;
}

/**
 * Generate a prompt for finding rotation URL and instructions
 */
export function rotationUrlPrompt(credential: CredentialInfo): string {
  return `Find the credential rotation information for this credential:

- ID: ${credential.id}
- Service: ${credential.service}
- Type: ${credential.type}
${credential.account ? `- Account: ${credential.account}` : ""}
${credential.notes ? `- Notes: ${credential.notes}` : ""}

I need:
1. The direct URL to the page where I can rotate/regenerate this credential
2. The name of the settings page or section
3. Step-by-step instructions for rotating the credential
4. Whether the old credential is invalidated immediately
5. Any warnings or considerations

Examples:

GitHub Personal Access Token:
- rotationUrl: https://github.com/settings/tokens
- pageName: Personal Access Tokens
- instructions: ["Navigate to Settings > Developer settings > Personal access tokens", "Find the token or click 'Generate new token'", "Configure scopes and expiration", "Copy the new token immediately"]
- immediateInvalidation: true (old token stops working immediately)
- warnings: ["Make sure to update all systems using this token before rotating", "New token is only shown once"]

OpenAI API Key:
- rotationUrl: https://platform.openai.com/api-keys
- pageName: API Keys
- instructions: ["Go to API Keys page", "Click 'Create new secret key'", "Give it a name and copy it", "Delete the old key after updating your systems"]
- immediateInvalidation: false (you can have multiple active keys)
- warnings: ["New key is only shown once upon creation"]

Vercel Token:
- rotationUrl: https://vercel.com/account/tokens
- pageName: Account Tokens
- instructions: ["Navigate to Account Settings > Tokens", "Click 'Create' to make a new token", "Name it and set scope", "Delete old token after updating systems"]
- immediateInvalidation: false (multiple tokens can coexist)

Supabase:
- rotationUrl: https://supabase.com/dashboard/account/tokens
- pageName: Access Tokens
- instructions: ["Go to Account > Access Tokens", "Generate a new token", "Update your systems with the new token", "Revoke the old token"]
- immediateInvalidation: false

Generate the rotation information for this specific credential.`;
}

/**
 * System prompt for rotation URL generation
 */
export const ROTATION_URL_SYSTEM_PROMPT = `You are a security expert who knows how to manage credentials across various services.

Your task is to provide accurate information about where and how to rotate credentials.

Rules:
- Provide real, verified URLs only - DO NOT make up or guess URLs
- If you are not certain about a URL, use the service's main settings/account page and note uncertainty
- For unknown services, provide the service's official documentation URL instead
- Instructions should be clear and actionable
- Always mention if rotating invalidates the old credential immediately
- Include relevant warnings
- If you cannot determine the rotation URL with confidence, set rotationUrl to the service's main website or docs

Return valid JSON only. No markdown, no explanation outside the JSON.`;
