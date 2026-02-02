# Moby Dock

> 🐋⚓ Where Moby comes home - AI assistant management console

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — Lint code
- `npm run test` — Run tests (when added)

## Architecture

### Overview
Moby Dock is a management console for configuring and monitoring an AI assistant (Moby). It connects to a file server on the Mac mini via Cloudflare Tunnel.

```
Browser → Vercel (UI) → files.skadauke.dev (Mac mini)
```

### Sections
1. **Command** — Task board (Supabase, reuses moby-kanban)
2. **Config** — Edit workspace files (Monaco editor)
3. **Vault** — Secrets management
4. **Log** — Activity feed
5. **Memory** — Knowledge base browser
6. **Skills** — Custom skills viewer

### File Server
- **URL:** `https://files.skadauke.dev`
- **Auth:** Bearer token in `MOBY_FILE_SERVER_TOKEN` env var
- **Endpoints:**
  - `GET /health` — Health check (no auth)
  - `GET /files?path=...` — Read file
  - `POST /files` — Write file `{path, content}`
  - `GET /files/list?dir=...` — List directory
  - `DELETE /files?path=...` — Delete file

### Database
Supabase (shared with moby-kanban project):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with nav
│   ├── page.tsx            # Home (redirects to /command)
│   ├── command/            # Task board section
│   ├── config/             # File editor section
│   ├── vault/              # Secrets section
│   ├── log/                # Activity feed section
│   ├── memory/             # Knowledge browser section
│   └── skills/             # Skills viewer section
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Nav, sidebar, etc.
│   ├── command/            # Command-specific components
│   ├── config/             # Config-specific components
│   └── ...                 # Other section components
├── hooks/                  # Custom React hooks
├── lib/
│   ├── api/                # API client functions
│   └── utils.ts            # Utilities
└── types/                  # TypeScript types
```

## Environment Variables

```bash
# File server
MOBY_FILE_SERVER_URL=https://files.skadauke.dev
MOBY_FILE_SERVER_TOKEN=your-token-here

# Supabase (from moby-kanban)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Auth (GitHub OAuth)
GITHUB_ID=xxx
GITHUB_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
```

## Design System

- **Theme:** Dark mode (zinc palette)
- **Accents:** Blue for interactive, amber for warnings
- **Components:** shadcn/ui
- **Editor:** Monaco (for Config section)

## Deviations from CODING.md

None — follows standard stack.
