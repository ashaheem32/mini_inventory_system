/** Where to go after saving/cancelling: the list URL (with filters) the user came from. */
export function getReturnTo(state: unknown): string {
  const returnTo = (state as { returnTo?: unknown } | null)?.returnTo;
  return typeof returnTo === "string" && /^\/products(\?|$)/.test(returnTo) ? returnTo : "/products";
}
