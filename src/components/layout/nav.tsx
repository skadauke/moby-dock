'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Settings,
  KeyRound,
  ScrollText,
  Brain,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { href: '/command', label: 'Command', icon: LayoutDashboard },
  { href: '/config', label: 'Config', icon: Settings },
  { href: '/vault', label: 'Vault', icon: KeyRound },
  { href: '/log', label: 'Log', icon: ScrollText },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/skills', label: 'Skills', icon: Sparkles },
];

interface NavProps {
  user?: Session['user'];
}

export function Nav({ user }: NavProps) {
  const pathname = usePathname();

  // Don't show nav on login page
  if (pathname === '/login') {
    return null;
  }

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

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-600">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-400">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
              <DropdownMenuLabel className="text-zinc-100">
                {user.name}
                <p className="text-xs font-normal text-zinc-500">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
