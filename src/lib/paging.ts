/** Reads a 1-based page number from a search param, defaulting to 1. */
export function readPage(value: string | null): number {
  return Math.max(1, Math.floor(Number(value)) || 1)
}
