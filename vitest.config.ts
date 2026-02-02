import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'node_modules/',
        '.next/',
        'src/components/ui/**', // shadcn components
        'src/app/**', // Next.js pages (integration tests needed)
        'src/types/**', // Type definitions only
        'src/lib/auth.ts', // better-auth config - external library
        'src/lib/auth-client.ts', // better-auth client - external library
        'src/lib/*-store.ts', // Zustand stores - need integration tests
        'src/lib/supabase/**', // Supabase clients - external dependency
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 65,
        lines: 70,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
