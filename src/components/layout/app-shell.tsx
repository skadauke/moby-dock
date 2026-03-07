"use client";

import { TerminalPanel } from "@/components/terminal/TerminalPanel";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <main className="flex-1 overflow-auto">{children}</main>
      <TerminalPanel />
    </div>
  );
}
