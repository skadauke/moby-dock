import { ScrollText } from 'lucide-react';

export default function LogPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
      <ScrollText className="h-16 w-16" />
      <h1 className="text-2xl font-semibold text-zinc-300">Log</h1>
      <p>Activity feed coming soon...</p>
    </div>
  );
}
