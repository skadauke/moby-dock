# 🐋⚓ Moby Dock

> The management console for your OpenClaw agent

Moby Dock is a web-based dashboard for managing [OpenClaw](https://github.com/openclaw/openclaw) AI agent deployments. It provides a unified interface for task management, configuration editing, memory browsing, credential management, and more — all designed for AI-human collaboration workflows.

## Features

### 📋 Command (Kanban Board)
A kanban board for managing tasks that your AI agents work on. Tasks flow through customizable columns (Ready → In Progress → Done), support priority levels, and can be assigned to specific agents. Agents pick up tasks automatically via API integration and report back when complete.

### ⚙️ Config Editor
Browse and edit agent workspace files with a Monaco-powered code editor you know and love from VS Code. Quick-access shortcuts to key files (SOUL.md, AGENTS.md, HEARTBEAT.md, MEMORY.md) and full file tree navigation across multiple agent workspaces and the OpenClaw configuration directory.

### 🧠 Memory Browser
Explore your agents' memory and conversation history:
- **Session transcripts** — browse past conversations
- **Memory files** — view/edit daily notes and long-term memory files
- **Semantic search** — search across all memory and sessions
- **Multi-agent support** — sessions from all agents displayed with agent badges

### ✨ Skills Viewer
Browse installed agent skills with documentation, configuration files, and script inspection.

### 🔑 Credential Vault
Centralized secrets management with:
- Encrypted storage for API keys, OAuth tokens, passwords, and identity documents
- Expiration tracking with alerts for soon-to-expire credentials
- One-click health checks to verify credentials are still valid
- Support for multiple credential types (API keys, logins, passports, payment cards, etc.)

### 🖥️ Integrated Terminal
A full terminal emulator (xterm.js) accessible via `Ctrl+\`` for direct shell access to the host machine. Useful for quick commands without leaving the dashboard.

### 🖥️ Remote Control
Web-based VNC viewer for remote desktop access to the host machine.

## Architecture

```text
                    ┌──────────────────┐   ┌─────────────────┐
  Browser ─────────>│   Moby Dock      │──>│    Supabase     │
                    │  Next.js/Vercel  │   │   (PostgreSQL)  │
                    └────────┬─────────┘   └─────────────────┘
                             │          \            
                             │           \  ┌─────────────────┐
                     Cloudflare Tunnel    ->│     Axiom       │
                             |              │   (Logging)     │
                             │              └─────────────────┘
          ┌──────────────────┼─────────────────────────────────┐
          │  Your Host       │───────────────────────┐         |
          │  ┌───────────────v──────┐  ┌─────────────┴──────┐  |
          │  │     File Server      │  │  OpenClaw Gateway  │  |
          │  │  (Agent workspaces)  │  │  (Agent sessions)  │  |
          │  └──────────────────────┘  └────────────────────┘  |
          └────────────────────────────────────────────────────┘
```

- **Frontend**: Next.js 15+ (App Router) with React Server Components
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Editor**: Monaco Editor (VS Code engine)
- **Database**: Supabase (PostgreSQL) for tasks, projects, and user data
- **Auth**: Better Auth with GitHub OAuth
- **Logging**: Axiom for structured event logging
- **Deployment**: Vercel (serverless)
- **File Access**: Custom file server on the host machine for agent workspace browsing

## Multi-Agent Support

Moby Dock supports multiple OpenClaw agents. Agent discovery reads from `openclaw.json` and resolves identity info (name, emoji) from each agent's workspace. The Memory Browser aggregates sessions across all agents, and the Config Editor can browse multiple agent workspaces simultaneously.

## Setup

### Prerequisites

- **Node.js** 18+ and **pnpm**
- A **GitHub account** (for OAuth authentication)
- A **Supabase** account (free tier works)
- A **Vercel** account (for deployment — free tier works)

### Automated Setup Using OpenClaw

The easiest way to set up Moby Dock is to have your OpenClaw agent do it for you. Read the following prompt and paste it into your agent:

<details>
<summary>Click to expand the bootstrap prompt</summary>

```text
You are helping me set up moby-dock, a web dashboard for managing OpenClaw AI agents.

**Note:** moby-dock is called that because its author, Stephan, named his agent "Moby". When you install this, it becomes *your* dock. Or home. Or pad. Or whatever. If you're Henry, this could be "Henry's Home." Have fun with naming — suggest a few options to your human to pick from!

1. Clone the repo:
   git clone https://github.com/skadauke/moby-dock.git /tmp/moby-dock
   cd /tmp/moby-dock

2. Install dependencies:
   pnpm install

3. Read your OpenClaw config to discover your setup:
   - By default this is in ~/.openclaw/openclaw.json
   - Note agent names, workspaces, and home directory
   - List agent workspace directories to find which paths exist

4. Create .env.local based on .env.example:
   - Set NEXT_PUBLIC_HOME_DIR and HOME_DIR based on your system
   - Set ALLOWED_FILE_PATHS based on your agent workspace paths from openclaw.json
   - For ALLOWED_GITHUB_USERS — this is your human's GitHub username. If you're unsure, ask them for it!
   - For BETTER_AUTH_URL and NEXT_PUBLIC_AUTH_URL — this will be the Vercel deployment URL. Come up with one based on what you and your human decided the name of your dock will be!

5. Guide your human through the manual steps:
   a. Create a GitHub OAuth app at https://github.com/settings/developers
      - Callback URL: https://<their-app>.vercel.app/api/auth/callback/github
      - Copy Client ID → GITHUB_ID, generate Client Secret → GITHUB_SECRET
   b. Create a Supabase project at https://supabase.com
      - Copy project URL, anon key, and service role key
      - Run the migration from supabase/migrations/

6. Once all env vars are filled in, read the .env.local file and add each
   variable to the Vercel project settings. Then deploy.

7. After deploying, tell your human to update their GitHub OAuth app callback
   URL to match the actual Vercel deployment URL.

8. Direct your human to test by visiting the Vercel deployment URL and signing
   in with GitHub. Note that things might not work perfectly on the first try —
   if something breaks, have your human describe the issue and you can debug
   and fix it. Stephan and Moby welcome PRs for any issues encountered!
```

</details>

## CI/CD

Deployed to Vercel via GitHub integration:
- **Pull requests** get automatic preview deployments
- **Merge to main** triggers production deployment

CI pipeline: lint, typecheck, build, tests (Vitest), security scan, CodeRabbit AI review.

## Why "Moby Dock"?

- 🐋 Where the whale comes home
- ⚓ A dock where things connect
- 📖 A nod to the great white whale

Built with ❤️ by Moby, Cody, and Stephan
