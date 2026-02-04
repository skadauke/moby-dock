# Moby Dock — Development Specification

> Living document for development standards and practices.

---

## Logging

We use [Axiom](https://axiom.co) via `next-axiom` for persistent, searchable logs across all environments.

### Why Log?

1. **Debug deployed issues** — No console access on Vercel
2. **Audit trail** — Who did what, when
3. **Performance monitoring** — Catch slow operations
4. **Error tracking** — Context for failures

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Detailed debugging info (dev only) | Variable values, flow tracing |
| `info` | Normal operations | Request received, operation succeeded |
| `warn` | Unexpected but handled | Missing optional param, retry succeeded |
| `error` | Failures needing attention | API error, external service down |

### What to Log

#### ✅ Always Log

- **API requests**: Method, path, userId (if authenticated)
- **External service calls**: Service name, operation, duration, outcome
- **Mutations**: Create/update/delete operations with entity type and ID
- **Auth events**: Login, logout, session failures, unauthorized access
- **Errors**: With enough context to debug (but no sensitive data)

#### ❌ Never Log

- Auth tokens, API keys, passwords
- Full file contents (log path and size instead)
- Personal data beyond userId
- High-frequency health checks

### Standard Pattern for API Routes

```typescript
import { Logger } from "next-axiom";

export async function POST(request: NextRequest) {
  const log = new Logger({ source: "api/example" });
  
  // 1. Log request received
  log.info("POST /api/example", { 
    userId: session?.user?.id,
    // key params (sanitized)
  });

  // 2. Log external calls with timing
  const startTime = Date.now();
  const result = await externalService.call();
  const duration = Date.now() - startTime;
  
  log.info("[Supabase] query", { 
    operation: "insert",
    table: "tasks",
    duration,
  });

  // 3. Log outcome
  if (result.error) {
    log.error("Operation failed", { 
      error: result.error.message,
      // relevant context
    });
  } else {
    log.info("Operation succeeded", { 
      id: result.data.id,
    });
  }

  // 4. ALWAYS flush before returning
  await log.flush();
  return NextResponse.json(result);
}
```

### Logging External Services

Each external service call should include:

```typescript
log.info("[ServiceName] operation", {
  operation: "what-it-does",
  duration: timeInMs,
  // outcome-specific data
});
```

Service names:
- `[Supabase]` — Database operations
- `[FileServer]` — File read/write/list
- `[Gateway]` — OpenClaw gateway calls
- `[GitHub]` — OAuth/API calls

### Error Logging

Always include context to help debugging:

```typescript
log.error("Task creation failed", {
  userId: session.user.id,
  input: { title, projectId }, // sanitized input
  error: error.message,
  code: error.code,
});
```

### Client-Side Logging

Use sparingly — only for key user actions and errors:

```typescript
"use client";
import { useLogger } from "next-axiom";

function Component() {
  const log = useLogger();
  
  const handleSave = async () => {
    log.info("User saved file", { path });
    // ...
  };
}
```

### Viewing Logs

1. Go to [Axiom Dashboard](https://app.axiom.co)
2. Select dataset: `moby-dock`
3. Query by:
   - `source` — Filter by API route
   - `level` — Filter by severity
   - `userId` — Filter by user
   - Time range — Recent issues

---

## Testing

*(TODO: Add testing standards)*

---

## Error Handling

*(TODO: Add error handling patterns)*

---

## API Design

*(TODO: Add API design guidelines)*

---

*Last updated: 2026-02-03*
