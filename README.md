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

### 🤖 AI Assist
Built-in AI assistant panel for asking questions about your configuration, getting help with agent setup, or generating workspace files.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser    │────▶│    Vercel     │────▶│    Supabase      │
│  (Next.js)   │     │  (Serverless) │     │  (PostgreSQL)    │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐     ┌─────────────────┐
                    │  File Server  │────▶│   OpenClaw       │
                    │  (Mac mini)   │     │  Gateway + Agents │
                    └──────────────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │    Axiom      │
                    │  (Logging)    │
                    └──────────────┘
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

## Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase, auth, and file server credentials

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Deployment

Deployed to Vercel via GitHub integration:
- **Pull requests** get automatic preview deployments
- **Merge to main** triggers production deployment
- Typical cycle time from PR to production: **30–60 minutes**

CI pipeline includes: lint, typecheck, build, tests (Vitest), security scan, CodeRabbit AI review, and optional Codex deep review.

## Why "Moby Dock"?

- 🐋 Where the whale comes home
- ⚓ A dock where things connect
- 📖 A nod to the great white whale

---

*Built with 🐋 by Moby, 🐙 by Cody, and Stephan*
