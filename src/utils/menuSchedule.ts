/**
 * Check whether a menu category is available right now based on its
 * available_from / available_until TIME strings (format "HH:MM" or "HH:MM:SS").
 *
 * Rules:
 *  - Both null → always available
 *  - from <= until  → available inside that window (e.g. 07:00–11:30)
 *  - from >  until  → crosses midnight (e.g. 22:00–02:00), available outside the gap
 */
export function isAvailableNow(
  availableFrom: string | null | undefined,
  availableUntil: string | null | undefined,
  now?: Date
): boolean {
  if (!availableFrom || !availableUntil) return true; // no restriction

  const d = now ?? new Date();
  const current = d.getHours() * 60 + d.getMinutes();

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const from = toMinutes(availableFrom);
  const until = toMinutes(availableUntil);

  if (from <= until) {
    // Normal window: e.g. 07:00–11:30
    return current >= from && current < until;
  } else {
    // Crosses midnight: e.g. 22:00–02:00
    return current >= from || current < until;
  }
}

/** Format "HH:MM:SS" → "h:MM AM/PM" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Returns minutes until next available window opens (for display). */
export function minutesUntilAvailable(
  availableFrom: string | null | undefined,
  now?: Date
): number | null {
  if (!availableFrom) return null;
  const d = now ?? new Date();
  const current = d.getHours() * 60 + d.getMinutes();
  const [h, m] = availableFrom.split(":").map(Number);
  const from = h * 60 + m;
  const diff = from - current;
  return diff >= 0 ? diff : diff + 24 * 60; // wrap if already past today
}
