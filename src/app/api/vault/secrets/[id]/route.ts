import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.FILE_SERVER_TOKEN || "";
const SECRETS_PATH = "~/.openclaw/credentials/secrets.json";

interface Credential {
  value?: string;
  client_id?: string;
  client_secret?: string;
  url?: string;
  anon_key?: string;
  service_role_key?: string;
  auth_token?: string;
  type: string;
  service: string;
  account?: string;
  email?: string;
  scopes?: string[];
  project?: string;
  expires: string | null;
  created: string;
  used_by: string[];
  notes?: string;
}

interface SecretsFile {
  credentials: Record<string, Credential>;
  _meta: {
    version: number;
    updated: string;
    check_expiry_days_before: number;
  };
}

// GET /api/vault/secrets/[id] - Get a single secret (with unmasked value)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log = new Logger({ source: "api/vault/secrets/[id]" });
  log.info("GET /api/vault/secrets/[id]", { id });

  const startTime = Date.now();

  try {
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
      }
    );

    const duration = Date.now() - startTime;

    if (!res.ok) {
      log.error("[FileServer] read secrets failed", { status: res.status, duration });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to read secrets" },
        { status: res.status }
      );
    }

    const { content } = await res.json();
    const secrets: SecretsFile = JSON.parse(content);

    const credential = secrets.credentials[id];
    if (!credential) {
      log.warn("Credential not found", { id, duration });
      await log.flush();
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    log.info("Credential retrieved", { id, type: credential.type, duration });
    await log.flush();

    return NextResponse.json({
      id,
      ...credential,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Failed to get credential", {
      error: error instanceof Error ? error.message : "Unknown error",
      id,
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to get credential" },
      { status: 500 }
    );
  }
}

// PATCH /api/vault/secrets/[id] - Update a credential
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log = new Logger({ source: "api/vault/secrets/[id]" });
  log.info("PATCH /api/vault/secrets/[id]", { id });

  const startTime = Date.now();

  try {
    const updates = await request.json();

    // Read existing secrets
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      log.error("[FileServer] read secrets failed", { status: res.status });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to read secrets" },
        { status: res.status }
      );
    }

    const { content } = await res.json();
    const secrets: SecretsFile = JSON.parse(content);

    if (!secrets.credentials[id]) {
      await log.flush();
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    // Update credential
    secrets.credentials[id] = {
      ...secrets.credentials[id],
      ...updates,
    };
    secrets._meta.updated = new Date().toISOString().split("T")[0];

    // Write back
    const writeRes = await fetch(`${FILE_SERVER_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: SECRETS_PATH,
        content: JSON.stringify(secrets, null, 2),
      }),
    });

    const duration = Date.now() - startTime;

    if (!writeRes.ok) {
      log.error("[FileServer] write secrets failed", { status: writeRes.status, duration });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to save secrets" },
        { status: writeRes.status }
      );
    }

    log.info("Credential updated", { id, duration });
    await log.flush();

    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Failed to update credential", {
      error: error instanceof Error ? error.message : "Unknown error",
      id,
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to update credential" },
      { status: 500 }
    );
  }
}

// DELETE /api/vault/secrets/[id] - Delete a credential
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log = new Logger({ source: "api/vault/secrets/[id]" });
  log.info("DELETE /api/vault/secrets/[id]", { id });

  const startTime = Date.now();

  try {
    // Read existing secrets
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      log.error("[FileServer] read secrets failed", { status: res.status });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to read secrets" },
        { status: res.status }
      );
    }

    const { content } = await res.json();
    const secrets: SecretsFile = JSON.parse(content);

    if (!secrets.credentials[id]) {
      await log.flush();
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    // Delete credential
    delete secrets.credentials[id];
    secrets._meta.updated = new Date().toISOString().split("T")[0];

    // Write back
    const writeRes = await fetch(`${FILE_SERVER_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: SECRETS_PATH,
        content: JSON.stringify(secrets, null, 2),
      }),
    });

    const duration = Date.now() - startTime;

    if (!writeRes.ok) {
      log.error("[FileServer] write secrets failed", { status: writeRes.status, duration });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to save secrets" },
        { status: writeRes.status }
      );
    }

    log.info("Credential deleted", { id, duration });
    await log.flush();

    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Failed to delete credential", {
      error: error instanceof Error ? error.message : "Unknown error",
      id,
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to delete credential" },
      { status: 500 }
    );
  }
}
