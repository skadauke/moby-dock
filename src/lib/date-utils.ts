/**
 * Date Formatting Utilities
 * 
 * Provides locale-aware date and time formatting functions with support for
 * relative times (e.g., "5 minutes ago") and absolute dates with year display.
 * 
 * @module date-utils
 */

/**
 * Format a date for display
 * - Shows full date with year for older dates
 * - Shows relative time for recent dates (within 24h)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  
  // Within last hour: show "X minutes ago"
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'just now';
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  }
  
  // Within last 24 hours: show "X hours ago"
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  
  // Within last 7 days: show "X days ago"
  if (diffDays < 7) {
    const days = Math.floor(diffDays);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  
  // Otherwise show full date with year
  return formatFullDate(d);
}

/**
 * Format a date with full date including year
 */
export function formatFullDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  
  // Always include year if not current year, or for clarity
  if (d.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  
  return d.toLocaleDateString('en-US', options);
}

/**
 * Format a date with full date and time, always including year
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format just the time portion
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
