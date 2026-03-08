/**
 * Path Validation
 * 
 * Security utilities for validating file paths against an allowlist.
 * Prevents path traversal attacks and unauthorized file access.
 */

import { homedir } from 'os';
import { resolve, normalize } from 'path';
import { realpathSync, existsSync } from 'fs';

/** Home directory - use HOME_DIR env var (set on Vercel) or OS homedir */
const HOME = process.env.HOME_DIR || homedir();

/** Allowed base directories for file operations */
const ALLOWED_BASE_DIRS = [
  '~/clawd',
  '~/.openclaw',
  '~/.clawdbot',  // Legacy
  '~/openclaw',   // Built-in skills (read-only)
];

/** Dangerous path segments that indicate traversal attempts */
const DANGEROUS_SEGMENTS = ['..', './', '../'];

/**
 * Expand ~ to home directory
 */
function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return resolve(HOME, path.slice(2));
  }
  if (path === '~') {
    return HOME;
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

  // Resolve symlinks to get the canonical path.
  // If the full path doesn't exist yet, resolve the closest existing ancestor.
  let canonical: string;
  if (existsSync(normalized)) {
    canonical = realpathSync(normalized);
  } else {
    // Walk up to find an existing ancestor, then append the remaining segments
    const parts = normalized.split('/');
    let existing = '/';
    let i = 1;
    for (; i < parts.length; i++) {
      const candidate = parts.slice(0, i + 1).join('/');
      if (!existsSync(candidate)) break;
      existing = candidate;
    }
    const resolved = realpathSync(existing);
    const remainder = parts.slice(i).join('/');
    canonical = remainder ? normalize(resolved + '/' + remainder) : resolved;
  }

  // Check if canonical path is under an allowed base directory (also resolved)
  const home = HOME;
  const allowedPaths = ALLOWED_BASE_DIRS.map(dir => expandTilde(dir));
  
  const isAllowed = allowedPaths.some(allowedPath => {
    const normalizedAllowed = normalize(allowedPath);
    // Resolve symlinks on the allowed directory too
    const canonicalAllowed = existsSync(normalizedAllowed)
      ? realpathSync(normalizedAllowed)
      : normalizedAllowed;
    return canonical === canonicalAllowed || canonical.startsWith(canonicalAllowed + '/');
  });

  if (!isAllowed) {
    return { 
      valid: false, 
      error: `Path not in allowed directories. Allowed: ${ALLOWED_BASE_DIRS.join(', ')}` 
    };
  }

  // Double-check no traversal after resolution
  const relativeTohome = canonical.slice(home.length);
  if (relativeTohome.includes('..')) {
    return { valid: false, error: 'Path traversal detected after normalization' };
  }

  return { valid: true, normalizedPath: canonical };
}

/**
 * Check if an object key is safe (not a prototype pollution vector)
 */
export function isSafeObjectKey(key: string): boolean {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  return !dangerous.includes(key.toLowerCase());
}
