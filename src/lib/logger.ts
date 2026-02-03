import { Logger } from "next-axiom";

// Re-export Logger for use in API routes
export { Logger };

/**
 * Log levels and their use cases:
 * - debug: Detailed info for debugging (not sent in production by default)
 * - info: Normal operations (user actions, API calls)
 * - warn: Unexpected but handled situations
 * - error: Failures that need attention
 */

/**
 * Create a logger for a specific component/route
 * Usage: const log = createLogger("api/files");
 */
export function createLogger(component: string) {
  const logger = new Logger();
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      logger.debug(message, { component, ...data }),
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info(message, { component, ...data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn(message, { component, ...data }),
    error: (message: string, data?: Record<string, unknown>) =>
      logger.error(message, { component, ...data }),
    // Flush logs (call at end of request)
    flush: () => logger.flush(),
  };
}

/**
 * Log an API request with timing
 */
export function logRequest(
  logger: ReturnType<typeof createLogger>,
  method: string,
  path: string,
  data?: Record<string, unknown>
) {
  logger.info(`${method} ${path}`, {
    method,
    path,
    ...data,
  });
}

/**
 * Log an external service call
 */
export function logExternalCall(
  logger: ReturnType<typeof createLogger>,
  service: string,
  operation: string,
  data?: Record<string, unknown>
) {
  logger.info(`[${service}] ${operation}`, {
    service,
    operation,
    ...data,
  });
}
