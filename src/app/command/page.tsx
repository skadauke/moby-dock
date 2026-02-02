import { LayoutDashboard } from 'lucide-react';

export default function CommandPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
      <LayoutDashboard className="h-16 w-16" />
      <h1 className="text-2xl font-semibold text-zinc-300">Command</h1>
      <p>Task board coming soon...</p>
    </div>
  );
}
