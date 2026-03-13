# Moby Dock — Setup Guide

Moby Dock is a web dashboard for managing [OpenClaw](https://github.com/openclaw) AI agents. This guide walks you through setting it up for your own use.

## Prerequisites

- **Node.js** 18+ and **pnpm** (or npm)
- A **GitHub account** (for OAuth authentication)
- A **Supabase** account (free tier works — used for database)
- A **Vercel** account (for deployment — free tier works)
- The **Moby Dock file server** running on your machine (see `file-server/` directory)

## Quick Start

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

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

### Required

| Variable | Description |
|---|---|
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `NEXTAUTH_SECRET` | Random secret for session encryption. Generate with: `openssl rand -base64 32` |
| `ALLOWED_GITHUB_USERS` | Comma-separated GitHub usernames allowed to sign in (e.g. `alice,bob`) |
| `BETTER_AUTH_URL` | Your production URL (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_AUTH_URL` | Same as `BETTER_AUTH_URL` (exposed to client) |
| `NEXT_PUBLIC_HOME_DIR` | Home directory on the file server machine (e.g. `/Users/alice`) |
| `HOME_DIR` | Same as `NEXT_PUBLIC_HOME_DIR` (server-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `FILE_SERVER_URL` | Your file server's public URL |
| `NEXT_PUBLIC_FILE_SERVER_URL` | Same as `FILE_SERVER_URL` (exposed to client) |
| `MOBY_FILE_SERVER_TOKEN` | Auth token for the file server |

### Optional

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

## Step-by-Step Setup

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** Moby Dock (or whatever you like)
   - **Homepage URL:** `http://localhost:3000` (update after deploying)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID** → `GITHUB_ID`
6. Generate a **Client Secret** → `GITHUB_SECRET`

> **After deploying to Vercel**, update the Homepage URL and callback URL to your production domain (e.g. `https://your-app.vercel.app/api/auth/callback/github`).

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set Up the File Server

The file server runs on your machine and gives Moby Dock access to read/write agent workspace files.

1. See the `file-server/` directory for the file server code
2. Set up and run the file server following its README
3. Set `FILE_SERVER_URL` and `NEXT_PUBLIC_FILE_SERVER_URL` to its public URL
4. Set `MOBY_FILE_SERVER_TOKEN` to the auth token you configure

### 4. Deploy to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Deploy
5. Update your GitHub OAuth app callback URL to: `https://your-app.vercel.app/api/auth/callback/github`
6. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_AUTH_URL` to your Vercel URL

## Agent Bootstrap Prompt

If you use OpenClaw, you can paste this prompt into your agent to have it help you set up Moby Dock:

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
   - Set ALLOWED_GITHUB_USERS to my GitHub username
   - Set BETTER_AUTH_URL and NEXT_PUBLIC_AUTH_URL to my planned Vercel deployment URL
   - Set ALLOWED_FILE_PATHS based on my agent workspace paths
   - Leave GitHub OAuth, Supabase, and file server values blank (I'll fill those in)

5. Guide me through the manual steps:
   - Create a GitHub OAuth app at https://github.com/settings/developers
     - Callback URL: https://<my-app>.vercel.app/api/auth/callback/github
   - Create a Supabase project at https://supabase.com
     - Copy project URL, anon key, and service role key into .env.local
   - Set up the file server from the file-server/ directory
   - Deploy to Vercel:
     - Push to GitHub
     - Import in Vercel
     - Add all env vars from .env.local
     - After deploy, update GitHub OAuth callback URL

6. After everything is configured, run locally to verify:
   pnpm dev
   Open http://localhost:3000 and sign in with GitHub
```

## Troubleshooting

- **"Access denied" after sign-in:** Make sure your GitHub username is in `ALLOWED_GITHUB_USERS`
- **OAuth callback errors:** Verify the callback URL in your GitHub OAuth app matches your deployment URL
- **File operations fail:** Check that `FILE_SERVER_URL` is correct and the file server is running
- **Blank pages:** Make sure `NEXT_PUBLIC_AUTH_URL` and `BETTER_AUTH_URL` are set to your deployment URL
