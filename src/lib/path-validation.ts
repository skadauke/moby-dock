/**
 * Path Validation
 * 
 * Security utilities for validating file paths against an allowlist.
 * Prevents path traversal attacks and unauthorized file access.
 */

import { homedir } from 'os';
import { resolve, normalize } from 'path';

/** Allowed base directories for file operations */
const ALLOWED_BASE_DIRS = [
  '~/clawd',
  '~/.openclaw',
  '~/.clawdbot',  // Legacy
];

/** Dangerous path segments that indicate traversal attempts */
const DANGEROUS_SEGMENTS = ['..', './', '../'];

/**
 * Expand ~ to home directory
 */
function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2));
  }
  if (path === '~') {
    return homedir();
  }
  return path;
}

/**
 * Validate a file path against the allowlist
 * 
 * @param path - The path to validate
 * @returns Validation result with error message if invalid
 */
export function validateFilePath(path: string): { valid: boolean; error?: string; normalizedPath?: string } {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Path is required and must be a string' };
  }

  // Check for dangerous segments before normalization
  for (const segment of DANGEROUS_SEGMENTS) {
    if (path.includes(segment)) {
      return { valid: false, error: 'Path traversal not allowed' };
    }
  }

  // Expand and normalize the path
  const expanded = expandTilde(path);
  const normalized = normalize(expanded);

  // Check if path is under an allowed base directory
  const home = homedir();
  const allowedPaths = ALLOWED_BASE_DIRS.map(dir => expandTilde(dir));
  
  const isAllowed = allowedPaths.some(allowedPath => {
    const normalizedAllowed = normalize(allowedPath);
    return normalized === normalizedAllowed || normalized.startsWith(normalizedAllowed + '/');
  });

  if (!isAllowed) {
    return { 
      valid: false, 
      error: `Path not in allowed directories. Allowed: ${ALLOWED_BASE_DIRS.join(', ')}` 
    };
  }

  // Double-check no traversal after normalization
  const relativeTohome = normalized.slice(home.length);
  if (relativeTohome.includes('..')) {
    return { valid: false, error: 'Path traversal detected after normalization' };
  }

  return { valid: true, normalizedPath: normalized };
}

/**
 * Check if an object key is safe (not a prototype pollution vector)
 */
export function isSafeObjectKey(key: string): boolean {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  return !dangerous.includes(key.toLowerCase());
}
