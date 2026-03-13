# 🐋⚓ Moby Dock

> The management console for your AI agents

Moby Dock is a web-based dashboard for managing [OpenClaw](https://github.com/openclaw/openclaw) AI agent deployments. It provides a unified interface for task management, configuration editing, memory browsing, credential management, and more — all designed for AI-human collaboration workflows.

Moby Dock works with any OpenClaw configuration — single agent or multi-agent, any model provider, any set of skills. The dashboard discovers your agents automatically from your `openclaw.json` config file.

The system has two parts: a **Next.js web app** deployed on Vercel, and a lightweight **file server** that runs on your host machine. The file server gives the web app secure access to your agent workspace files, configuration, credentials, session transcripts, and provides terminal and VNC remote access. It communicates through a Cloudflare Tunnel (or similar reverse proxy) so the Vercel-hosted frontend can reach your local machine.

## Features

### 📋 Command (Kanban Board)
A full kanban board for managing tasks that your AI agents work on. Tasks flow through customizable columns (Backlog → Ready → In Progress → Done), support priority levels, and can be assigned to specific agents. Agents pick up tasks automatically via API integration and report back when complete.

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

> **Note:** The Vault reads from your OpenClaw `secrets.json` file (`~/.openclaw/credentials/secrets.json`) and expects **version 3 format** — a JSON object with `{ "version": 3, "items": [...] }`. If your existing secrets file uses the older v2 format (a flat `credentials` dictionary), the Vault will automatically migrate it to v3 on first load. If you don't have a secrets file yet, the Vault will work with an empty one. The bootstrap prompt below includes instructions for your agent to set this up.

### 🖥️ Integrated Terminal
A full terminal emulator (xterm.js) accessible via `Ctrl+\`` for direct shell access to the host machine. Useful for quick commands without leaving the dashboard.

### 🖥️ Remote Control
Web-based VNC viewer for remote desktop access to the host machine, powered by noVNC. Requires a VNC server running on the host (e.g., Screen Sharing on macOS, x11vnc on Linux).

## Architecture

```text
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
          │  │  (Workspace files,   │  │  (Agent sessions)   │
          │  │   terminal, VNC)     │  │                     │
          │  └──────────────────────┘  └────────────────────┘
          └──────────────────────────────────────────────────┘
```

- **Frontend**: Next.js 15 (App Router) with React Server Components
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Editor**: Monaco Editor (VS Code engine)
- **Database**: Supabase (PostgreSQL) for tasks, projects, and user data
- **Auth**: Better Auth with GitHub OAuth (cookie-based sessions, no database needed for auth)
- **Logging**: Axiom for structured event logging
- **Deployment**: Vercel (serverless, auto-deploys on merge to main)
- **File Server**: Custom Node.js server on the host machine — serves workspace files, provides WebSocket terminal and VNC proxy
- **Tunnel**: Cloudflare Tunnel (free tier) exposes the file server to the internet securely

## Multi-Agent Support

Moby Dock supports multiple OpenClaw agents. Agent discovery reads from `openclaw.json` and resolves identity info (name, emoji) from each agent's workspace. The Memory Browser aggregates sessions across all agents, and the Config Editor can browse multiple agent workspaces simultaneously.

---

## Setup

### Automated Setup Using OpenClaw

The easiest way to set up Moby Dock is to have your OpenClaw agent do it for you. Paste the following prompt into your agent:

> **Note:** moby-dock is called that because its author, Stephan, named his agent Moby. When you install this, it becomes *your* dock — or home, or pad, or bridge, or whatever feels right. If your agent is named Jarvis, this could be "Jarvis Control." Have fun with naming — suggest a few options to your human to pick from!

<details>
<summary>Click to expand the bootstrap prompt</summary>

```text
You are helping me set up moby-dock, a web dashboard for managing OpenClaw AI agents.

## Phase 1: Clone and discover

1. Clone the repo:
   git clone https://github.com/skadauke/moby-dock.git /tmp/moby-dock
   cd /tmp/moby-dock

2. Install dependencies:
   pnpm install

3. Read my OpenClaw config to discover my setup:
   - Read ~/.openclaw/openclaw.json
   - Note my agent names, workspaces, and home directory
   - List my agent workspace directories to find which paths exist

## Phase 2: Create .env.local

4. Create .env.local based on .env.example:
   - Set NEXT_PUBLIC_HOME_DIR and HOME_DIR to my home directory
   - Set ALLOWED_FILE_PATHS based on my agent workspace paths from openclaw.json
   - Generate BETTER_AUTH_SECRET: openssl rand -base64 32
   - Generate MOBY_FILE_SERVER_TOKEN: openssl rand -hex 32
   - Generate DOCK_API_TOKEN: openssl rand -hex 32
   - For ALLOWED_GITHUB_USERS — ask your human for their GitHub username
   - For BETTER_AUTH_URL and NEXT_PUBLIC_AUTH_URL — ask your human what they
     want their Vercel deployment URL to be (e.g. https://my-dock.vercel.app)

## Phase 3: Guide human through external service setup

5. Walk your human through creating these accounts/services:

   a. GitHub OAuth App:
      - Go to https://github.com/settings/developers → New OAuth App
      - Callback URL: https://<their-app>.vercel.app/api/auth/callback/github
      - Copy Client ID → GITHUB_ID, generate Client Secret → GITHUB_SECRET

   b. Supabase project:
      - Create at https://supabase.com (free tier works)
      - Copy project URL → NEXT_PUBLIC_SUPABASE_URL
      - Copy anon key → NEXT_PUBLIC_SUPABASE_ANON_KEY
      - Copy service role key → SUPABASE_SERVICE_ROLE_KEY
      - Go to the SQL Editor and run the contents of:
        supabase/migrations/00000000000000_initial_schema.sql
        (This creates the tasks, projects, and quick_access_items tables)

   c. Cloudflare Tunnel (free — Cloudflare account + domain required):
      - The human needs a domain managed by Cloudflare DNS. If they don't have
        one, they can register one at https://dash.cloudflare.com (Registrar tab)
        — Cloudflare offers at-cost pricing with no markup.
      - Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
      - Run: cloudflared tunnel login
      - Create a tunnel: cloudflared tunnel create <tunnel-name>
      - Create a DNS route: cloudflared tunnel route dns <tunnel-name> <subdomain.yourdomain.com>
      - Create ~/.cloudflared/config.yml:
        tunnel: <tunnel-name>
        credentials-file: ~/.cloudflared/<tunnel-id>.json
        ingress:
          - hostname: <subdomain.yourdomain.com>
            service: http://localhost:3001
          - service: http_status:404
      - Set FILE_SERVER_URL and NEXT_PUBLIC_FILE_SERVER_URL to https://<subdomain.yourdomain.com>
      - Note: If the human doesn't have a domain, they can use cloudflared's
        quick tunnels (cloudflared tunnel --url http://localhost:3001) but these
        generate random URLs that change on restart. A named tunnel with a
        custom domain is recommended for production use.

   d. Axiom logging (recommended):
      - Create account at https://axiom.co (free tier: 500MB/month)
      - Create a dataset
      - Create an API token with ingest permissions
      - Set NEXT_PUBLIC_AXIOM_TOKEN and NEXT_PUBLIC_AXIOM_DATASET

   e. OpenClaw Gateway connection:
      - CLAWDBOT_GATEWAY_URL is usually http://127.0.0.1:18789
      - CLAWDBOT_GATEWAY_TOKEN: read from ~/.openclaw/openclaw.json
        (look for gateway.token or similar auth config)

## Phase 4: Set up the file server

6. Set up the file server:
   - Create file-server/.env with:
     AUTH_TOKEN=<the MOBY_FILE_SERVER_TOKEN value you generated>
     AXIOM_TOKEN=<axiom token if using axiom>
     AXIOM_DATASET=<axiom dataset if using axiom>
   - Test it: cd file-server && node index.js
     (It should start on port 3001)
   - Set it up as a system service so it starts on boot. Detect the host OS
     and create the appropriate service file:

     macOS (launchd):
       Create ~/Library/LaunchAgents/com.dock.fileserver.plist with
       ProgramArguments pointing to node and file-server/index.js,
       RunAtLoad and KeepAlive true, PATH including node's location.
       Then: launchctl load ~/Library/LaunchAgents/com.dock.fileserver.plist

     Linux (systemd user service):
       Create ~/.config/systemd/user/dock-fileserver.service with
       ExecStart pointing to node index.js, WorkingDirectory to file-server/,
       Restart=always, and EnvironmentFile pointing to file-server/.env.
       Then: systemctl --user enable --now dock-fileserver

   - Similarly, set up the Cloudflare tunnel as a system service:
     macOS: cloudflared service install
     Linux: sudo cloudflared service install

## Phase 5: Set up the Vault secrets file

7. Check if ~/.openclaw/credentials/secrets.json exists:
   - If it exists and has version: 3 format, it's ready for the Vault.
   - If it exists but uses the older v2 format (a "credentials" dictionary),
     the Vault will auto-migrate it to v3 on first load.
   - If it doesn't exist, create it:
     mkdir -p ~/.openclaw/credentials
     echo '{"version": 3, "items": []}' > ~/.openclaw/credentials/secrets.json

## Phase 6: Deploy to Vercel

8. Push the repo to GitHub (or fork it).

9. Read the .env.local file and add ALL variables to the Vercel project:
   - Import the repo at vercel.com
   - Go to Settings → Environment Variables
   - Add each variable from .env.local
   - IMPORTANT: Set HOME_DIR and NEXT_PUBLIC_HOME_DIR as "plain text" type,
     NOT "sensitive/encrypted" — Vercel encrypted vars return garbled values
     for non-secret data like file paths.

10. Deploy and tell your human to update their GitHub OAuth app callback URL
    to match the actual Vercel deployment URL.

11. Direct your human to test by visiting the Vercel URL and signing in with
    GitHub. Check that:
    - Login works (GitHub OAuth)
    - Config editor loads files
    - Memory browser shows sessions
    - Terminal opens (Ctrl+`)
    - Vault page loads (may be empty if no secrets yet)

If something doesn't work on the first try — have your human describe the
issue and debug it together. We welcome PRs for any issues encountered!
```

</details>

### Manual Setup

If you prefer to set things up manually, follow these steps.

#### Prerequisites

- **Node.js** 18+ and **pnpm**
- A **GitHub account** (for OAuth authentication)
- A **Supabase** account (free tier works)
- A **Vercel** account (for deployment — free tier works)
- A **Cloudflare** account (free tier — for tunneling to your file server)
- A **domain name** managed by Cloudflare DNS (for a stable tunnel URL). You can register a domain directly through [Cloudflare Registrar](https://dash.cloudflare.com/?to=/:account/domains/register) — prices are at-cost with no markup. Alternatively, you can use quick tunnels without a domain, but the URL changes on every restart.

#### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/skadauke/moby-dock.git
cd moby-dock

# 2. Install dependencies
pnpm install

# 3. Copy the example env file
cp .env.example .env.local

# 4. Fill in your env vars (see below)
```

#### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Description |
|---|---|
| **Auth** | |
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `BETTER_AUTH_SECRET` | Session encryption secret. Generate: `openssl rand -base64 32` |
| `ALLOWED_GITHUB_USERS` | Comma-separated GitHub usernames allowed to sign in |
| `BETTER_AUTH_URL` | Your production URL (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_AUTH_URL` | Same as `BETTER_AUTH_URL` (exposed to client) |
| **Host** | |
| `NEXT_PUBLIC_HOME_DIR` | Home directory on the file server machine |
| `HOME_DIR` | Same as `NEXT_PUBLIC_HOME_DIR` (server-side) |
| **Database** | |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| **File Server** | |
| `FILE_SERVER_URL` | Your file server's public URL (server-side) |
| `NEXT_PUBLIC_FILE_SERVER_URL` | Same as `FILE_SERVER_URL` (exposed to client for WebSocket) |
| `MOBY_FILE_SERVER_TOKEN` | Auth token for the file server |
| **Logging** | |
| `NEXT_PUBLIC_AXIOM_TOKEN` | Axiom logging token |
| `NEXT_PUBLIC_AXIOM_DATASET` | Axiom dataset name |
| **OpenClaw Gateway** | |
| `CLAWDBOT_GATEWAY_URL` | OpenClaw Gateway URL (default: `http://127.0.0.1:18789`) |
| `CLAWDBOT_GATEWAY_TOKEN` | OpenClaw Gateway auth token |
| **API** | |
| `DOCK_API_TOKEN` | API token for agent access to the dashboard |
| **Paths** | |
| `ALLOWED_FILE_PATHS` | Comma-separated allowed file paths (default: `~/clawd,~/clawd-dev,~/.openclaw,~/openclaw`) |
| **UI** | |
| `NEXT_PUBLIC_GITHUB_REPO` | GitHub repo URL shown in nav (default: `https://github.com/skadauke/moby-dock`) |
| `NEXT_PUBLIC_VERCEL_PROJECT` | Vercel project path for nav link (e.g. `team/project-name`) |

> **Why are some variables duplicated?** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser (client-side). Their non-prefixed counterparts are server-side only. The file server URL, for example, is needed both server-side (API proxy) and client-side (WebSocket for terminal/VNC).

#### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** Your app name
   - **Homepage URL:** `http://localhost:3000` (update after deploying)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Copy the **Client ID** → `GITHUB_ID`
5. Generate a **Client Secret** → `GITHUB_SECRET`

> After deploying to Vercel, update the Homepage URL and callback URL to your production domain.

#### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to the **SQL Editor** and run the initial schema migration:
   - Copy the contents of `supabase/migrations/00000000000000_initial_schema.sql`
   - This creates the `tasks`, `projects`, and `quick_access_items` tables with indexes, triggers, and RLS

#### 3. Set Up the File Server

The file server runs on your host machine and gives the dashboard access to read/write agent workspace files, plus WebSocket-based terminal and VNC access.

1. Create `file-server/.env`:
   ```
   AUTH_TOKEN=<generate with: openssl rand -hex 32>
   AXIOM_TOKEN=<your axiom token, if using>
   AXIOM_DATASET=<your axiom dataset, if using>
   ```
2. Test it: `cd file-server && node index.js` (starts on port 3001)
3. Set it up as a system service:

   **macOS (launchd):**
   ```bash
   # Create the plist (adjust paths to match your setup)
   cat > ~/Library/LaunchAgents/com.dock.fileserver.plist << 'EOF'
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
     "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0"><dict>
     <key>Label</key><string>com.dock.fileserver</string>
     <key>ProgramArguments</key><array>
       <string>node</string>
       <string>/path/to/moby-dock/file-server/index.js</string>
     </array>
     <key>WorkingDirectory</key><string>/path/to/moby-dock/file-server</string>
     <key>RunAtLoad</key><true/>
     <key>KeepAlive</key><true/>
     <key>EnvironmentVariables</key><dict>
       <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
     </dict>
   </dict></plist>
   EOF
   launchctl load ~/Library/LaunchAgents/com.dock.fileserver.plist
   ```

   **Linux (systemd user service):**
   ```bash
   mkdir -p ~/.config/systemd/user
   cat > ~/.config/systemd/user/dock-fileserver.service << 'EOF'
   [Unit]
   Description=Dock File Server
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/path/to/moby-dock/file-server
   ExecStart=/usr/bin/node index.js
   Restart=always
   EnvironmentFile=/path/to/moby-dock/file-server/.env

   [Install]
   WantedBy=default.target
   EOF
   systemctl --user enable --now dock-fileserver
   ```

#### 4. Set Up a Cloudflare Tunnel

The Vercel-hosted frontend needs to reach your file server over the internet. A Cloudflare Tunnel creates a secure outbound connection from your machine — no port forwarding needed.

1. [Create a free Cloudflare account](https://dash.cloudflare.com/sign-up) and add your domain
2. [Install `cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
3. Authenticate: `cloudflared tunnel login`
4. Create a named tunnel: `cloudflared tunnel create my-dock`
5. Add a DNS route: `cloudflared tunnel route dns my-dock files.yourdomain.com`
6. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: my-dock
   credentials-file: ~/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: files.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```
7. Run as a service:
   - **macOS:** `sudo cloudflared service install` then `sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist`
   - **Linux:** `sudo cloudflared service install` then `sudo systemctl enable --now cloudflared`
8. Set `FILE_SERVER_URL` and `NEXT_PUBLIC_FILE_SERVER_URL` to `https://files.yourdomain.com`

> **Don't have a domain?** You can use `cloudflared tunnel --url http://localhost:3001` for a quick tunnel with a random `trycloudflare.com` URL, but it changes every restart. For production use, a named tunnel with your own domain is recommended. Cloudflare Tunnels are free on all plans, including the free tier.

#### 5. Deploy to Vercel

1. Push your repo to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` to the Vercel project settings
   - ⚠️ Set `HOME_DIR` and `NEXT_PUBLIC_HOME_DIR` as **plain text**, not "sensitive" — Vercel encrypted vars return garbled values for non-secret path data
4. Deploy
5. Update your GitHub OAuth app callback URL to: `https://your-app.vercel.app/api/auth/callback/github`
6. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_AUTH_URL` to your Vercel URL

#### 6. Set Up the Vault (optional)

The Credential Vault reads from `~/.openclaw/credentials/secrets.json`. If you don't have one yet:

```bash
mkdir -p ~/.openclaw/credentials
echo '{"version": 3, "items": []}' > ~/.openclaw/credentials/secrets.json
```

If you have an existing OpenClaw secrets file in the older v2 format, the Vault will automatically migrate it to v3 on first load.

---

If something doesn't work, describe the issue to your OpenClaw agent and have it debug and fix it. We welcome PRs that fix issues users encounter!

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

Built with ❤️ by Moby, Cody, and Stephan
