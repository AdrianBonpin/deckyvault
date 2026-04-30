/**
 * Simple class name utility that filters out falsy values and joins with spaces.
 * This is a lightweight alternative to clsx/tailwind-merge for projects that
 * don't need the full complexity of those libraries.
 */
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}
