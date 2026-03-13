# 🐋⚓ Moby Dock

> The management console for your AI agents

Moby Dock is a web-based dashboard for managing [OpenClaw](https://github.com/openclaw/openclaw) AI agent deployments. It provides a unified interface for task management, configuration editing, memory browsing, credential management, and more — all designed for AI-human collaboration workflows.

## Features

### 📋 Command (Kanban Board)
A full kanban board for managing tasks that your AI agents work on. Tasks flow through customizable columns (Ready → In Progress → Done), support priority levels, and can be assigned to specific agents. Agents pick up tasks automatically via API integration and report back when complete.

### ⚙️ Config Editor
Browse and edit agent workspace files with a Monaco-powered code editor. Quick-access shortcuts to critical files (SOUL.md, AGENTS.md, HEARTBEAT.md, MEMORY.md) and full file tree navigation across multiple agent workspaces and the OpenClaw configuration directory.

### 🧠 Memory Browser
Explore your agents' memory and conversation history:
- **Session transcripts** — browse past conversations with temporal grouping (Today, Yesterday, Last 7 days, etc.)
- **Memory files** — daily notes and long-term memory files
- **Semantic search** — search across all memory and sessions
- **Multi-agent support** — sessions from all agents displayed with agent badges

### ✨ Skills Viewer
Browse installed agent skills with documentation, configuration files, and script inspection. Skills extend agent capabilities (web search, calendar integration, browser automation, shopping, etc.).

### 🔑 Credential Vault
Centralized secrets management with:
- Encrypted storage for API keys, OAuth tokens, passwords, and identity documents
- Expiration tracking with alerts for soon-to-expire credentials
- One-click health checks to verify credentials are still valid
- Support for multiple credential types (API keys, logins, passports, payment cards, etc.)

### 🖥️ Integrated Terminal
A full terminal emulator (xterm.js) accessible via `Ctrl+\`` for direct shell access to the host machine. Useful for quick commands without leaving the dashboard.

### 🖥️ Remote Control
Web-based VNC viewer for remote desktop access to the host machine via Screen Sharing, powered by noVNC.

### 🤖 AI Assist
Built-in AI assistant panel for asking questions about your configuration, getting help with agent setup, or generating workspace files.

## Architecture

```
                    ┌──────────────────┐   ┌─────────────────┐
  Browser ─────────▶│   Moby Dock      │──▶│    Supabase      │
                    │  Next.js/Vercel   │   │   (PostgreSQL)   │
                    └────────┬─────────┘   └─────────────────┘
                             │                      
                             │              ┌─────────────────┐
                     Cloudflare Tunnel      │     Axiom        │
                      (or other proxy)      │   (Logging)      │
                             │              └─────────────────┘
          ┌──────────────────┼───────────────────────┐
          │  Your Host       │                       │
          │  ┌───────────────▼──────┐  ┌─────────────┴──────┐
          │  │     File Server      │  │  OpenClaw Gateway   │
          │  │  (Agent workspaces)  │  │  (Agent sessions)   │
          │  └──────────────────────┘  └────────────────────┘
          └──────────────────────────────────────────────────┘
```

- **Frontend**: Next.js 15 (App Router) with React Server Components
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Editor**: Monaco Editor (VS Code engine)
- **Database**: Supabase (PostgreSQL) for tasks, projects, and user data
- **Auth**: Better Auth with GitHub OAuth
- **Logging**: Axiom for structured event logging
- **Deployment**: Vercel (serverless, auto-deploys on merge to main)
- **File Access**: Custom file server on the host machine for agent workspace browsing

## Multi-Agent Support

Moby Dock supports multiple OpenClaw agents. Agent discovery reads from `openclaw.json` and resolves identity info (name, emoji) from each agent's workspace. The Memory Browser aggregates sessions across all agents, and the Config Editor can browse multiple agent workspaces simultaneously.

---

## Setup

### Prerequisites

- **Node.js** 18+ and **pnpm**
- A **GitHub account** (for OAuth authentication)
- A **Supabase** account (free tier works)
- A **Vercel** account (for deployment — free tier works)
- The **file server** running on your machine (see `file-server/`)

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/openclaw/moby-dock.git
cd moby-dock

# 2. Install dependencies
pnpm install

# 3. Copy the example env file
cp .env.example .env.local

# 4. Fill in your env vars (see below)

# 5. Run locally
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

#### Required

| Variable | Description |
|---|---|
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `NEXTAUTH_SECRET` | Session encryption secret. Generate: `openssl rand -base64 32` |
| `ALLOWED_GITHUB_USERS` | Comma-separated GitHub usernames allowed to sign in |
| `BETTER_AUTH_URL` | Your production URL (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_AUTH_URL` | Same as `BETTER_AUTH_URL` (exposed to client) |
| `NEXT_PUBLIC_HOME_DIR` | Home directory on the file server machine |
| `HOME_DIR` | Same as `NEXT_PUBLIC_HOME_DIR` (server-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `FILE_SERVER_URL` | Your file server's public URL |
| `NEXT_PUBLIC_FILE_SERVER_URL` | Same as `FILE_SERVER_URL` (exposed to client) |
| `MOBY_FILE_SERVER_TOKEN` | Auth token for the file server |

#### Optional

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_AXIOM_TOKEN` | Axiom logging token |
| `NEXT_PUBLIC_AXIOM_DATASET` | Axiom dataset name |
| `OPENAI_API_KEY` | OpenAI API key (for AI features) |
| `CLAWDBOT_GATEWAY_URL` | OpenClaw Gateway URL (default: `http://127.0.0.1:18789`) |
| `CLAWDBOT_GATEWAY_TOKEN` | OpenClaw Gateway auth token |
| `MOBY_API_TOKEN` | API token for agent access |
| `ALLOWED_FILE_PATHS` | Comma-separated allowed file paths (default: `~/clawd,~/clawd-dev,~/.openclaw,~/openclaw`) |
| `NEXT_PUBLIC_GITHUB_REPO` | GitHub repo URL shown in nav bar |

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** Moby Dock (or whatever you like)
   - **Homepage URL:** `http://localhost:3000` (update after deploying)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Copy the **Client ID** → `GITHUB_ID`
5. Generate a **Client Secret** → `GITHUB_SECRET`

> After deploying to Vercel, update the Homepage URL and callback URL to your production domain.

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
3. Run the migration in `supabase/migrations/` to create the required tables

### 3. Set Up the File Server

The file server runs on your machine and gives Moby Dock access to read/write agent workspace files.

1. See the `file-server/` directory
2. Copy `file-server/.env.example` to `file-server/.env` and configure
3. Run with `node file-server/index.js` (or set up as a system service)
4. Expose via a tunnel (e.g. Cloudflare Tunnel) for Vercel to reach it
5. Set `FILE_SERVER_URL` / `NEXT_PUBLIC_FILE_SERVER_URL` to the public URL

### 4. Deploy to Vercel

1. Push your repo to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy
5. Update your GitHub OAuth app callback URL to: `https://your-app.vercel.app/api/auth/callback/github`
6. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_AUTH_URL` to your Vercel URL

### Troubleshooting

- **"Access denied" after sign-in** — Make sure your GitHub username is in `ALLOWED_GITHUB_USERS`
- **OAuth callback errors** — Verify the callback URL in your GitHub OAuth app matches your deployment URL
- **File operations fail** — Check that `FILE_SERVER_URL` is correct and the file server is running
- **Blank pages** — Make sure `NEXT_PUBLIC_AUTH_URL` and `BETTER_AUTH_URL` are set

---

## Agent Bootstrap Prompt

If you use OpenClaw, paste this prompt into your agent to have it help you set up Moby Dock automatically:

<details>
<summary>Click to expand the bootstrap prompt</summary>

```
You are helping me set up moby-dock, a web dashboard for managing OpenClaw AI agents.

1. Clone the repo:
   git clone https://github.com/openclaw/moby-dock.git /tmp/moby-dock
   cd /tmp/moby-dock

2. Install dependencies:
   pnpm install

3. Read my OpenClaw config to discover my setup:
   - Read ~/.openclaw/openclaw.json
   - Note my agent names, workspaces, and home directory
   - List my agent workspace directories to find which paths exist

4. Create .env.local based on .env.example:
   - Set NEXT_PUBLIC_HOME_DIR and HOME_DIR to my home directory
   - Set ALLOWED_GITHUB_USERS to my GitHub username (ask me)
   - Set BETTER_AUTH_URL and NEXT_PUBLIC_AUTH_URL to my planned Vercel URL (ask me)
   - Set ALLOWED_FILE_PATHS based on my agent workspace paths from openclaw.json
   - Leave GitHub OAuth, Supabase, and file server values blank — guide me through those

5. Guide me through the manual steps:
   a. Create a GitHub OAuth app at https://github.com/settings/developers
      - Callback URL: https://<my-app>.vercel.app/api/auth/callback/github
   b. Create a Supabase project at https://supabase.com
      - Copy project URL, anon key, and service role key into .env.local
      - Run the migration from supabase/migrations/
   c. Set up the file server from the file-server/ directory
      - Create file-server/.env with AUTH_TOKEN
      - Run it and expose via Cloudflare Tunnel or similar
   d. Deploy to Vercel:
      - Push to GitHub
      - Import in Vercel, add all env vars
      - After deploy, update GitHub OAuth callback URL

6. After everything is configured, run locally to verify:
   pnpm dev
   Open http://localhost:3000 and sign in with GitHub
```

</details>

---

## Development

```bash
pnpm dev          # Run development server
pnpm test         # Run tests
pnpm build        # Build for production
pnpm lint         # Lint
```

## CI/CD

Deployed to Vercel via GitHub integration:
- **Pull requests** get automatic preview deployments
- **Merge to main** triggers production deployment

CI pipeline: lint, typecheck, build, tests (Vitest), security scan, CodeRabbit AI review.

## Why "Moby Dock"?

- 🐋 Where the whale comes home
- ⚓ A dock where things connect
- 📖 A nod to the great white whale
