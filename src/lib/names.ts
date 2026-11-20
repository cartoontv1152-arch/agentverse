/** "asha.rao+tag@example.com" -> "Asha Rao". Used when sign-up didn't collect a name. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0].split("+")[0];
  const words = local.split(/[._-]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return (name || "New member").slice(0, 60);
}
