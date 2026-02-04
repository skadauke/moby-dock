import { NextRequest, NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import type { SecretsFile } from "@/lib/vault";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";
const SECRETS_PATH = "~/.openclaw/credentials/secrets.json";

/** Allowed fields for PATCH updates (whitelist) */
const ALLOWED_UPDATE_FIELDS = [
  'value', 'client_id', 'client_secret', 'url', 'anon_key', 
  'service_role_key', 'auth_token', 'type', 'service', 'account',
  'email', 'scopes', 'project', 'expires', 'used_by', 'notes', 'test'
] as const;

/** Schema for PATCH update validation */
const CredentialUpdateSchema = z.object({
  value: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  url: z.string().url().optional().nullable(),
  anon_key: z.string().optional(),
  service_role_key: z.string().optional(),
  auth_token: z.string().optional(),
  type: z.string().min(1).max(50).optional(),
  service: z.string().min(1).max(100).optional(),
  account: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  scopes: z.array(z.string()).optional(),
  project: z.string().max(200).optional().nullable(),
  expires: z.string().nullable().optional(),
  used_by: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable(),
  test: z.any().optional(), // TestConfig validated separately
  expectedVersion: z.string(),
});

// GET /api/vault/secrets/[id] - Get a single secret (with unmasked value)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log = new Logger({ source: "api/vault/secrets/[id]" });
  
  // Auth check - critical for secret reveal
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to vault secret", { id });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  log.info("GET /api/vault/secrets/[id]", { id, userId: session.user.id });

  const startTime = Date.now();

  try {
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
        signal: AbortSignal.timeout(10000),
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
      // Include version for optimistic locking on subsequent writes
      currentVersion: secrets._meta.updated,
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
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to update vault secret", { id });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  log.info("PATCH /api/vault/secrets/[id]", { id, userId: session.user.id });

  const startTime = Date.now();

  try {
    const body = await request.json();
    
    // Validate with Zod schema
    const validation = CredentialUpdateSchema.safeParse(body);
    if (!validation.success) {
      log.warn("PATCH validation failed", { id, issues: validation.error.issues });
      await log.flush();
      return NextResponse.json({ 
        error: "Invalid update data",
        details: validation.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message
        }))
      }, { status: 400 });
    }
    
    const { expectedVersion, ...updateData } = validation.data;
    
    // Filter to only allowed fields (whitelist)
    const allowedUpdates: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in updateData && updateData[field as keyof typeof updateData] !== undefined) {
        allowedUpdates[field] = updateData[field as keyof typeof updateData];
      }
    }
    
    // Log if any fields were filtered out
    const providedFields = Object.keys(updateData);
    const filteredFields = providedFields.filter(f => !ALLOWED_UPDATE_FIELDS.includes(f as typeof ALLOWED_UPDATE_FIELDS[number]));
    if (filteredFields.length > 0) {
      log.warn("Some fields were filtered from PATCH", { id, filteredFields });
    }

    // Read existing secrets
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
        signal: AbortSignal.timeout(10000),
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
    
    // Optimistic locking: reject if file changed since client's version
    if (secrets._meta.updated !== expectedVersion) {
      log.warn("Concurrent modification detected", {
        id,
        expectedVersion,
        actualVersion: secrets._meta.updated,
        userId: session.user.id,
      });
      await log.flush();
      return NextResponse.json(
        { 
          error: "Conflict: secrets file was modified by another request",
          currentVersion: secrets._meta.updated,
        },
        { status: 409 }
      );
    }

    // Update credential with sanitized fields
    secrets.credentials[id] = {
      ...secrets.credentials[id],
      ...allowedUpdates,
    };
    // Use full ISO timestamp for optimistic locking (not just date)
    secrets._meta.updated = new Date().toISOString();

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
      signal: AbortSignal.timeout(10000),
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

    log.info("Credential updated", { id, updatedFields: Object.keys(allowedUpdates), duration });
    await log.flush();

    return NextResponse.json({ success: true, version: secrets._meta.updated });
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
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to delete vault secret", { id });
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Get expectedVersion from query params for optimistic locking (required)
  const expectedVersion = request.nextUrl.searchParams.get("expectedVersion");
  
  if (!expectedVersion) {
    log.warn("DELETE missing expectedVersion", { id, userId: session.user.id });
    await log.flush();
    return NextResponse.json(
      { error: "expectedVersion query param is required for deletes" },
      { status: 400 }
    );
  }
  
  log.info("DELETE /api/vault/secrets/[id]", { id, userId: session.user.id, expectedVersion });

  const startTime = Date.now();

  try {
    // Read existing secrets
    const res = await fetch(
      `${FILE_SERVER_URL}/files?path=${encodeURIComponent(SECRETS_PATH)}`,
      {
        headers: {
          Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
        },
        signal: AbortSignal.timeout(10000),
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
    
    // Optimistic locking: reject if file changed since client's version
    if (secrets._meta.updated !== expectedVersion) {
      log.warn("Concurrent modification detected on delete", {
        id,
        expectedVersion,
        actualVersion: secrets._meta.updated,
        userId: session.user.id,
      });
      await log.flush();
      return NextResponse.json(
        { 
          error: "Conflict: secrets file was modified by another request",
          currentVersion: secrets._meta.updated,
        },
        { status: 409 }
      );
    }

    // Delete credential
    delete secrets.credentials[id];
    // Use full ISO timestamp for optimistic locking (not just date)
    secrets._meta.updated = new Date().toISOString();

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
      signal: AbortSignal.timeout(10000),
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
