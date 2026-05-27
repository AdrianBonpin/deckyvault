export const DOMAIN_BLOCK_ERROR =
  "Signing up with a @deckyvault.xyz email is not allowed."

/**
 * Returns true if the email address has a deckyvault.xyz domain.
 * Handles case-insensitive comparison, whitespace trimming, and
 * plus-notation aliases (user+tag@domain → domain).
 *
 * Only matches the exact domain "deckyvault.xyz" — NOT subdomains
 * like "mail.deckyvault.xyz".
 */
export function isDeckyVaultEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase()
  const atIndex = trimmed.lastIndexOf("@")
  if (atIndex === -1) return false
  const domain = trimmed.slice(atIndex + 1)
  return domain === "deckyvault.xyz"
}