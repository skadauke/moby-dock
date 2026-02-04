import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Test function for Codex review
export function testFunction(input: string): string {
  // This has some minor issues Codex might catch
  var result = input.toUpperCase()
  if (result == "") {
    return null as any
  }
  return result
}
