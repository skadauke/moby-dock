import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Credential, SecretsFile } from "@/lib/vault";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";
const SECRETS_PATH = "~/.openclaw/credentials/secrets.json";

// GET /api/vault/secrets - List all secrets (values masked)
export async function GET() {
  const log = new Logger({ source: "api/vault/secrets" });
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to vault");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  log.info("GET /api/vault/secrets", { userId: session.user.id });

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

    // Mask all secret values
    const maskedCredentials = Object.entries(secrets.credentials).map(
      ([key, cred]) => ({
        id: key,
        type: cred.type,
        service: cred.service,
        account: cred.account,
        email: cred.email,
        project: cred.project,
        expires: cred.expires,
        created: cred.created,
        used_by: cred.used_by,
        notes: cred.notes,
        // Include field names that have values (for UI to know what to show)
        hasValue: !!cred.value,
        hasClientId: !!cred.client_id,
        hasClientSecret: !!cred.client_secret,
        hasUrl: !!cred.url,
        hasAnonKey: !!cred.anon_key,
        hasServiceRoleKey: !!cred.service_role_key,
        hasAuthToken: !!cred.auth_token,
        // Test configuration status
        hasTest: !!cred.test,
        lastTestResult: cred.lastTestResult,
      })
    );

    log.info("[FileServer] read secrets succeeded", {
      duration,
      count: maskedCredentials.length,
    });
    await log.flush();

    return NextResponse.json({
      credentials: maskedCredentials,
      meta: secrets._meta,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Failed to read secrets", {
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to read secrets" },
      { status: 500 }
    );
  }
}

// POST /api/vault/secrets - Add a new credential
export async function POST(request: Request) {
  const log = new Logger({ source: "api/vault/secrets" });
  
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to vault");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  log.info("POST /api/vault/secrets", { userId: session.user.id });

  const startTime = Date.now();

  try {
    const body = await request.json();
    
    // Input validation - reject arrays and non-objects
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      await log.flush();
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
    const { id, type, service, value, used_by, expectedVersion, ...rest } = body;

    if (!id || typeof id !== "string") {
      await log.flush();
      return NextResponse.json({ error: "ID is required and must be a string" }, { status: 400 });
    }
    
    if (!type || typeof type !== "string") {
      await log.flush();
      return NextResponse.json({ error: "Type is required and must be a string" }, { status: 400 });
    }
    
    if (!service || typeof service !== "string") {
      await log.flush();
      return NextResponse.json({ error: "Service is required and must be a string" }, { status: 400 });
    }
    
    // Validate used_by is an array if provided
    if (used_by !== undefined && !Array.isArray(used_by)) {
      await log.flush();
      return NextResponse.json({ error: "used_by must be an array" }, { status: 400 });
    }
    
    // Build validated credential object
    const credential = {
      type,
      service,
      value,
      used_by: used_by || [],
      ...rest,
    };

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
    
    // Optimistic locking: reject if file changed since client's version
    if (expectedVersion && secrets._meta.updated !== expectedVersion) {
      log.warn("Concurrent modification detected on create", {
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

    // Check if ID already exists
    if (secrets.credentials[id]) {
      await log.flush();
      return NextResponse.json(
        { error: "Credential with this ID already exists" },
        { status: 409 }
      );
    }

    // Add new credential
    secrets.credentials[id] = {
      ...credential,
      created: credential.created || new Date().toISOString().split("T")[0],
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

    log.info("Credential created", { id, type: credential.type, duration });
    await log.flush();

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Failed to create credential", {
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to create credential" },
      { status: 500 }
    );
  }
}
