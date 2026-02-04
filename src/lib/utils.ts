import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Test function for Codex review
export function testFunction(input: string): string | null {
  const result = input.toUpperCase()
  return result === "" ? null : result
}
