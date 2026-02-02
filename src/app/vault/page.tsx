import { KeyRound } from 'lucide-react';

export default function VaultPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
      <KeyRound className="h-16 w-16" />
      <h1 className="text-2xl font-semibold text-zinc-300">Vault</h1>
      <p>Secrets management coming soon...</p>
    </div>
  );
}
