// Task board types - ported from moby-kanban with IN_PROGRESS → READY rename

export type Status = "BACKLOG" | "READY" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Creator = "MOBY" | "STEPHAN";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority | null;
  creator: Creator;
  needsReview: boolean;
  position: number;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: Status;
  title: string;
  tasks: Task[];
}

export const COLUMNS: { id: Status; title: string }[] = [
  { id: "BACKLOG", title: "Backlog" },
  { id: "READY", title: "Ready" },
  { id: "DONE", title: "Done" },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "LOW", label: "Low", color: "bg-slate-500" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-500" },
  { value: "HIGH", label: "High", color: "bg-amber-500" },
  { value: "URGENT", label: "Urgent", color: "bg-red-500" },
];

export const CREATORS: { value: Creator; label: string; emoji: string }[] = [
  { value: "MOBY", label: "Moby", emoji: "🐋" },
  { value: "STEPHAN", label: "Stephan", emoji: "👤" },
];

// Map old status to new for database compatibility
export const STATUS_MAP: Record<string, Status> = {
  "BACKLOG": "BACKLOG",
  "IN_PROGRESS": "READY",  // Legacy mapping
  "READY": "READY",
  "DONE": "DONE",
};

export function normalizeStatus(status: string): Status {
  return STATUS_MAP[status] || "BACKLOG";
}
