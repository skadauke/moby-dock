'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Settings,
  KeyRound,
  ScrollText,
  Brain,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { href: '/command', label: 'Command', icon: LayoutDashboard },
  { href: '/config', label: 'Config', icon: Settings },
  { href: '/vault', label: 'Vault', icon: KeyRound },
  { href: '/log', label: 'Log', icon: ScrollText },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/skills', label: 'Skills', icon: Sparkles },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex h-14 items-center px-4 gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-2xl">🐋</span>
          <span className="text-zinc-100">Moby Dock</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User menu placeholder */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
            👤
          </div>
        </div>
      </div>
    </header>
  );
}
