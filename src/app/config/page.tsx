import { Settings } from 'lucide-react';

export default function ConfigPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
      <Settings className="h-16 w-16" />
      <h1 className="text-2xl font-semibold text-zinc-300">Config</h1>
      <p>File editor coming soon...</p>
    </div>
  );
}
