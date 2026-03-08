/**
 * Test configuration presets for known API services.
 *
 * Each preset provides a ready-to-use TestConfig that validates the credential
 * by hitting the service's lightweight "whoami" / "models" / "me" endpoint.
 */

import type { TestConfig } from './types';

export interface TestPreset {
  /** Human-readable service label */
  label: string;
  /** Matching keys (lowercase, underscored) */
  keys: string[];
  /** The pre-filled test configuration */
  test: TestConfig;
}

export const TEST_PRESETS: TestPreset[] = [
  {
    label: 'OpenAI',
    keys: ['openai', 'open_ai'],
    test: {
      method: 'GET',
      url: 'https://api.openai.com/v1/models',
      headers: { Authorization: 'Bearer $VALUE' },
      expectStatus: 200,
    },
  },
  {
    label: 'Anthropic',
    keys: ['anthropic', 'claude'],
    test: {
      method: 'GET',
      url: 'https://api.anthropic.com/v1/models',
      headers: {
        'x-api-key': '$VALUE',
        'anthropic-version': '2023-06-01',
      },
      expectStatus: 200,
    },
  },
  {
    label: 'GitHub',
    keys: ['github', 'gh'],
    test: {
      method: 'GET',
      url: 'https://api.github.com/user',
      headers: { Authorization: 'Bearer $VALUE' },
      expectStatus: 200,
    },
  },
  {
    label: 'Vercel',
    keys: ['vercel'],
    test: {
      method: 'GET',
      url: 'https://api.vercel.com/v2/user',
      headers: { Authorization: 'Bearer $VALUE' },
      expectStatus: 200,
    },
  },
  {
    label: 'Supabase',
    keys: ['supabase'],
    test: {
      method: 'GET',
      url: 'https://api.supabase.com/v1/projects',
      headers: { Authorization: 'Bearer $VALUE' },
      expectStatus: 200,
    },
  },
  {
    label: 'Google AI',
    keys: ['google_ai', 'google_gemini', 'gemini'],
    test: {
      method: 'GET',
      url: 'https://generativelanguage.googleapis.com/v1beta/models?key=$VALUE',
      expectStatus: 200,
    },
  },
  {
    label: 'Telegram',
    keys: ['telegram', 'telegram_bot'],
    test: {
      method: 'GET',
      url: 'https://api.telegram.org/bot$VALUE/getMe',
      expectStatus: 200,
    },
  },
  {
    label: 'ElevenLabs',
    keys: ['elevenlabs', 'eleven_labs'],
    test: {
      method: 'GET',
      url: 'https://api.elevenlabs.io/v1/user',
      headers: { 'xi-api-key': '$VALUE' },
      expectStatus: 200,
    },
  },
];

/**
 * Find a test preset matching a service name.
 * Matches against lowercase/underscored service name.
 */
export function getTestPreset(service: string): TestPreset | null {
  const normalized = service.toLowerCase().replace(/[\s-]+/g, '_');
  return TEST_PRESETS.find((p) => p.keys.some((k) => normalized.includes(k))) ?? null;
}
