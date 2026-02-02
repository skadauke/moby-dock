"use client";

interface ProvidersProps {
  children: React.ReactNode;
}

// Better Auth doesn't require a SessionProvider wrapper
// The useSession hook works directly without context
export function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}
