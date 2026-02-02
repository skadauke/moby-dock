import { describe, it, expect } from "vitest";
import { ok, err, DbError, Result } from "@/lib/result";

describe("Result type helpers", () => {
  describe("ok()", () => {
    it("creates a success result with data", () => {
      const result = ok("hello");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe("hello");
      }
    });

    it("works with complex objects", () => {
      const data = { id: 1, name: "test", nested: { value: 42 } };
      const result = ok(data);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(data);
      }
    });

    it("works with arrays", () => {
      const result = ok([1, 2, 3]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it("works with null and undefined", () => {
      const nullResult = ok(null);
      const undefinedResult = ok(undefined);
      
      expect(nullResult.ok).toBe(true);
      expect(undefinedResult.ok).toBe(true);
      if (nullResult.ok) expect(nullResult.data).toBeNull();
      if (undefinedResult.ok) expect(undefinedResult.data).toBeUndefined();
    });
  });

  describe("err()", () => {
    it("creates an error result", () => {
      const result = err(new Error("something went wrong"));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("something went wrong");
      }
    });

    it("works with string errors", () => {
      const result = err("simple error");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("simple error");
      }
    });

    it("works with custom error objects", () => {
      const customError = { code: 404, message: "Not found" };
      const result = err(customError);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(customError);
      }
    });
  });

  describe("Result type narrowing", () => {
    it("allows type-safe access after checking ok", () => {
      const success: Result<string, Error> = ok("data");
      const failure: Result<string, Error> = err(new Error("oops"));

      if (success.ok) {
        // TypeScript knows data exists here
        expect(success.data.toUpperCase()).toBe("DATA");
      }

      if (!failure.ok) {
        // TypeScript knows error exists here
        expect(failure.error.message).toBe("oops");
      }
    });
  });
});

describe("DbError", () => {
  describe("constructor", () => {
    it("creates error with message and default code", () => {
      const error = new DbError("Something failed");
      expect(error.message).toBe("Something failed");
      expect(error.code).toBe("UNKNOWN");
      expect(error.name).toBe("DbError");
    });

    it("creates error with specific code", () => {
      const notFound = new DbError("Item not found", "NOT_FOUND");
      const constraint = new DbError("Duplicate key", "CONSTRAINT");
      const connection = new DbError("Connection lost", "CONNECTION");

      expect(notFound.code).toBe("NOT_FOUND");
      expect(constraint.code).toBe("CONSTRAINT");
      expect(connection.code).toBe("CONNECTION");
    });
  });

  describe("httpStatus", () => {
    it("returns 404 for NOT_FOUND", () => {
      const error = new DbError("Not found", "NOT_FOUND");
      expect(error.httpStatus).toBe(404);
    });

    it("returns 400 for CONSTRAINT", () => {
      const error = new DbError("Constraint violation", "CONSTRAINT");
      expect(error.httpStatus).toBe(400);
    });

    it("returns 500 for CONNECTION", () => {
      const error = new DbError("Connection error", "CONNECTION");
      expect(error.httpStatus).toBe(500);
    });

    it("returns 500 for UNKNOWN", () => {
      const error = new DbError("Unknown error", "UNKNOWN");
      expect(error.httpStatus).toBe(500);
    });

    it("returns 500 for default (no code specified)", () => {
      const error = new DbError("Generic error");
      expect(error.httpStatus).toBe(500);
    });
  });

  describe("inheritance", () => {
    it("is instanceof Error", () => {
      const error = new DbError("Test");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DbError);
    });

    it("has proper stack trace", () => {
      const error = new DbError("Test error");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("DbError");
    });
  });
});
