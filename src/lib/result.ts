// Result type for explicit error handling
export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Helper to create success result
export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

// Helper to create error result
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Database error with code for proper status mapping
export class DbError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "CONSTRAINT" | "CONNECTION" | "UNKNOWN" = "UNKNOWN"
  ) {
    super(message);
    this.name = "DbError";
  }

  // Map to HTTP status code
  get httpStatus(): number {
    switch (this.code) {
      case "NOT_FOUND":
        return 404;
      case "CONSTRAINT":
        return 400;
      case "CONNECTION":
      case "UNKNOWN":
      default:
        return 500;
    }
  }
}
