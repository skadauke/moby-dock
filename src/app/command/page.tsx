import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAllTasks } from "@/lib/api-store";
import { CommandClient } from "./client";

export default async function CommandPage() {
  // Server-side auth check - redirect to login if not authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  const tasksResult = await getAllTasks();

  if (!tasksResult.ok) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-100">Failed to load tasks</h2>
          <p className="text-zinc-400 mt-2">{tasksResult.error.message}</p>
        </div>
      </div>
    );
  }

  const tasks = tasksResult.data;

  return <CommandClient initialTasks={tasks} />;
}
