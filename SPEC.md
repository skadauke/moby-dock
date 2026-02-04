# Moby Dock — Specification

> 🐋⚓ Where Moby comes home

**Purpose:** A management console for AI-human collaboration. Configure, monitor, and direct your AI assistant.

---

## Sections

### 1. Command (Tasks)

The task board — what Moby should work on.

- Kanban board: **Backlog** | **Ready** | **Done**
- Drag-and-drop between columns
- Task cards with: title, details, priority, creator, flag
- Project filtering (sidebar)
- **"Ping Moby" button** — triggers Moby to check Ready queue
- **API** to allow Moby to CRUD tasks and projects

---

### 2. Config (Workspace Files)

Edit workspace configuration files with a proper editor.

- **Monaco Editor** (VS Code's editor component)
- Files exposed by default (editable):
  - `SOUL.md` — Moby's personality/persona
  - `AGENTS.md` — Workspace rules and behaviors
  - `HEARTBEAT.md` — Periodic check configuration
  - `TOOLS.md` — Local tool notes and settings
  - `USER.md` — Info about the human
  - `IDENTITY.md` — Moby's name, avatar, etc.
  - `openclaw.json` — Gateway configuration
- **Save button** (Cmd/Ctrl+S)
- **"Restart Gateway" button** for config changes

---

### 3. Vault (Secrets)

Secure secrets management with visibility into credentials.

- Parse `~/.openclaw/credentials/secrets.json` + `auth-profiles.json`
- **Masked by default** — click to reveal, click to copy
- Add/edit/delete credentials through UI
- **Expiration warnings** (visual indicator for expiring soon)

---

### 4. Log (Activity Feed)

What has Moby been doing?

- **Timeline view** (reverse chronological)
- Data sources:
  - Memory files (`memory/*.md`)
  - Session logs
- Filter by date, type, etc.

---

### 5. Memory (Knowledge Base)

Browse what Moby remembers.

- **Two views:**
  - `MEMORY.md` (long-term, editable)
  - Daily files (calendar browser)
- **Search** across all memory files
- Quick navigation by date

---

### 6. Skills (Custom Skills)

View and manage custom skill configurations.

- List `~/.openclaw/skills/*/SKILL.md`
- View/edit SKILL.md for each
- Metadata: name, description, etc.

---

### 7. Terminal

Integrated terminal for direct host access.

- Connect to OpenClaw host and open a terminal session
- **Open with Ctrl+`** (just like VS Code)
- **Bottom panel** — not a full-page section, visible alongside other sections
- Persistent across navigation

---

### 8. Remote Control

View and control the OpenClaw host screen.

- Connect to OpenClaw host and view the screen
- Use existing frameworks (VNC, noVNC, or similar)
- Full-page section for screen viewing

---

## Architecture

| Component | Technology |
|-----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Editor** | Monaco Editor |
| **Database** | Supabase |
| **Files** | Cloudflare Tunnel → local file server |
| **Deployment** | Vercel (serverless via GitHub) |
| **Logging** | Axiom (next-axiom) |

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

### Service Names

- `[Supabase]` — Database operations
- `[FileServer]` — File read/write/list
- `[Gateway]` — OpenClaw gateway calls
- `[GitHub]` — OAuth/API calls

### Client-Side Logging

Use sparingly — only for key user actions and errors:

```typescript
"use client";
import { useLogger } from "next-axiom";

function Component() {
  const log = useLogger();
  
  const handleSave = async () => {
    log.info("User saved file", { path });
  };
}
```

### Viewing Logs

1. Go to [Axiom Dashboard](https://app.axiom.co)
2. Select dataset: `moby-dock`
3. Query by: `source`, `level`, `userId`, time range

---

## TODO

- [ ] Testing standards
- [ ] Error handling patterns
- [ ] API design guidelines

---

*Last updated: 2026-02-03*
