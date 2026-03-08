/**
 * Vault Type Schemas
 *
 * Defines the structure (fields, icons, categories) for every credential type.
 */

import type { VaultItemType } from './types';

export type FieldType = 'text' | 'secret' | 'date' | 'textarea' | 'select' | 'tags' | 'country';
export type Category = 'secrets' | 'personal';

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
  validation?: 'email' | 'phone';
}

export interface TypeSchema {
  label: string;
  icon: string;          // lucide-react icon name
  category: Category;
  fields: FieldSchema[];
  testable: boolean;
}

/**
 * Master registry of all vault item types and their field schemas.
 */
export const CREDENTIAL_TYPES: Record<VaultItemType, TypeSchema> = {
  // ═══════════════════ Secrets ═══════════════════

  api_key: {
    label: 'API Key',
    icon: 'Key',
    category: 'secrets',
    testable: true,
    fields: [
      { key: 'value', label: 'API Key', type: 'secret', required: true },
      { key: 'service', label: 'Service', type: 'text', placeholder: 'e.g. OpenAI', description: 'Used for matching test presets and organizing credentials' },
      { key: 'scope', label: 'Scope', type: 'text', placeholder: 'e.g. read:models' },
      { key: 'expires', label: 'Expires', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'usedBy', label: 'Used By', type: 'tags', placeholder: 'Add project or file…' },
    ],
  },

  oauth_credential: {
    label: 'OAuth Credential',
    icon: 'ShieldCheck',
    category: 'secrets',
    testable: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'secret' },
      { key: 'clientSecret', label: 'Client Secret', type: 'secret' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'secret' },
      { key: 'accessToken', label: 'Access Token', type: 'secret' },
      { key: 'tokenUrl', label: 'Token URL', type: 'text', placeholder: 'https://…/oauth/token' },
      { key: 'service', label: 'Service', type: 'text', placeholder: 'e.g. GitHub OAuth', description: 'Used for matching test presets and organizing credentials' },
      { key: 'scope', label: 'Scope', type: 'text' },
      { key: 'expires', label: 'Expires', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'usedBy', label: 'Used By', type: 'tags' },
    ],
  },

  app_password: {
    label: 'App Password',
    icon: 'Lock',
    category: 'secrets',
    testable: false,
    fields: [
      { key: 'value', label: 'Password', type: 'secret', required: true },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'service', label: 'Service', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'expires', label: 'Expires', type: 'date' },
    ],
  },

  login: {
    label: 'Login',
    icon: 'LogIn',
    category: 'secrets',
    testable: false,
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'secret', required: true },
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://…' },
      { key: 'service', label: 'Service', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },

    ],
  },

  // ═══════════════════ Personal ═══════════════════

  identity: {
    label: 'Identity',
    icon: 'User',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'firstName', label: 'First Name', type: 'text', required: true },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'user@example.com', validation: 'email' },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1 (555) 123-4567', validation: 'phone' },
      { key: 'birthday', label: 'Birthday', type: 'date' },
      { key: 'street', label: 'Street', type: 'text' },
      { key: 'apartment', label: 'Apartment', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zip', label: 'ZIP', type: 'text' },
      { key: 'country', label: 'Country', type: 'country' },
    ],
  },

  payment_card: {
    label: 'Payment Card',
    icon: 'CreditCard',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'cardholderName', label: 'Cardholder Name', type: 'text', required: true },
      { key: 'number', label: 'Card Number', type: 'secret', required: true },
      { key: 'expiry', label: 'Expiry (MM/YY)', type: 'text', required: true, placeholder: 'MM/YY' },
      { key: 'cvv', label: 'CVV', type: 'secret', required: true },
      { key: 'brand', label: 'Brand', type: 'select', options: ['Visa', 'Mastercard', 'Amex', 'Discover', 'Other'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  bank_account: {
    label: 'Bank Account',
    icon: 'Landmark',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
      { key: 'routingNumber', label: 'Routing Number', type: 'secret', required: true },
      { key: 'accountNumber', label: 'Account Number', type: 'secret', required: true },
      { key: 'accountType', label: 'Account Type', type: 'select', options: ['Checking', 'Savings', 'Credit', 'Investment', 'Other'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  secure_note: {
    label: 'Secure Note',
    icon: 'FileText',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'content', label: 'Content', type: 'textarea', required: true },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
  },

  passport: {
    label: 'Passport',
    icon: 'BookOpen',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'fullName', label: 'Full Name', type: 'text', required: true },
      { key: 'number', label: 'Passport Number', type: 'secret', required: true },
      { key: 'country', label: 'Country', type: 'country', required: true },
      { key: 'issueDate', label: 'Issue Date', type: 'date' },
      { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  drivers_license: {
    label: "Driver's License",
    icon: 'Car',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'fullName', label: 'Full Name', type: 'text', required: true },
      { key: 'number', label: 'License Number', type: 'secret', required: true },
      { key: 'state', label: 'State', type: 'text', required: true },
      { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
      { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
      { key: 'class', label: 'Class', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  ssn: {
    label: 'SSN',
    icon: 'Hash',
    category: 'personal',
    testable: false,
    fields: [
      { key: 'fullName', label: 'Full Name', type: 'text', required: true },
      { key: 'number', label: 'SSN', type: 'secret', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
} as const;

/**
 * Get all types in a given category.
 */
export function getTypesByCategory(category: Category): VaultItemType[] {
  return (Object.keys(CREDENTIAL_TYPES) as VaultItemType[]).filter(
    (t) => CREDENTIAL_TYPES[t].category === category,
  );
}

/**
 * Return the set of field keys that are secret-typed for a given item type.
 */
export function getSecretFieldKeys(type: VaultItemType): Set<string> {
  const schema = CREDENTIAL_TYPES[type];
  if (!schema) return new Set();
  return new Set(schema.fields.filter((f) => f.type === 'secret').map((f) => f.key));
}

/**
 * Sidebar groupings for the UI.
 */
export const SIDEBAR_GROUPS = {
  secrets: [
    { type: 'api_key' as VaultItemType, label: 'API Keys' },
    { type: 'oauth_credential' as VaultItemType, label: 'OAuth' },
    { type: 'app_password' as VaultItemType, label: 'App Passwords' },
    { type: 'login' as VaultItemType, label: 'Logins' },
  ],
  personal: [
    { type: 'identity' as VaultItemType, label: 'Identities' },
    { type: 'payment_card' as VaultItemType, label: 'Payment Cards' },
    { type: 'bank_account' as VaultItemType, label: 'Bank Accounts' },
    { type: 'secure_note' as VaultItemType, label: 'Notes' },
    { type: 'passport' as VaultItemType, label: 'Passports' },
    { type: 'drivers_license' as VaultItemType, label: 'Licenses' },
    { type: 'ssn' as VaultItemType, label: 'SSN' },
  ],
} as const;
