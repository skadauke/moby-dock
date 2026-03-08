import { NextResponse } from "next/server";
import { Logger } from "next-axiom";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getAllTasks } from "@/lib/api-store";

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || "http://localhost:4001";
const FILE_SERVER_TOKEN = process.env.MOBY_FILE_SERVER_TOKEN || "";

// Rate limiting: max 1 notification per minute
let lastNotifyTime = 0;
const RATE_LIMIT_MS = 60_000;

export async function POST() {
  const log = new Logger({ source: "api/gateway/notify" });

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    log.warn("Unauthorized access attempt to gateway notify");
    await log.flush();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const now = Date.now();
  if (now - lastNotifyTime < RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - lastNotifyTime)) / 1000);
    log.warn("Rate limited", { userId: session.user.id, retryAfter });
    await log.flush();
    return NextResponse.json(
      { error: "Rate limited. Try again in " + retryAfter + "s." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  log.info("POST /api/gateway/notify", { userId: session.user.id });

  try {
    // Check Ready queue for tasks
    const result = await getAllTasks();
    if (!result.ok) {
      log.error("Failed to fetch tasks", { error: result.error });
      await log.flush();
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
    const readyTasks = result.data.filter(
      (t) => t.status === "READY"
    );

    if (readyTasks.length === 0) {
      log.info("No tasks in Ready queue");
      await log.flush();
      return NextResponse.json({ success: true, notified: false, reason: "No tasks in queue" });
    }

    // Build task summary (server-side, not user-supplied)
    const taskLines = readyTasks.map((t) => {
      const parts = [`**${t.title}**`];
      if (t.description) parts.push(`Details: ${t.description}`);
      if (t.priority) parts.push(`Priority: ${t.priority}`);
      parts.push(`Creator: ${t.creator}`);
      if (t.projectId) parts.push(`Project: ${t.projectId}`);
      parts.push(`Created: ${new Date(t.createdAt).toLocaleDateString()}`);
      parts.push(`Updated: ${new Date(t.updatedAt).toLocaleDateString()}`);
      return parts.join("\n");
    });

    const message =
      `New task${readyTasks.length > 1 ? "s" : ""} ready in Moby Kanban:\n\n` +
      taskLines.join("\n\n---\n\n");

    // Send to file server → gateway
    const res = await fetch(`${FILE_SERVER_URL}/gateway/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FILE_SERVER_TOKEN}`,
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(15000),
    });

    const duration = Date.now() - lastNotifyTime;

    if (!res.ok) {
      const errorText = await res.text();
      log.error("[Gateway] notify failed", {
        status: res.status,
        errorLength: errorText.length,
      });
      await log.flush();
      return NextResponse.json(
        { error: "Failed to notify Moby" },
        { status: res.status }
      );
    }

    lastNotifyTime = now;
    const data = await res.json();
    log.info("[Gateway] notify succeeded", {
      taskCount: readyTasks.length,
    });
    await log.flush();

    return NextResponse.json({
      success: true,
      notified: true,
      taskCount: readyTasks.length,
    });
  } catch (error) {
    log.error("[Gateway] notify error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    await log.flush();

    return NextResponse.json(
      { error: "Failed to connect to gateway" },
      { status: 500 }
    );
  }
}
