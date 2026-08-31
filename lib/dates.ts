import { CHALLENGE_DAYS, DAILY_TARGET, END, START } from "./roster";

export function isoNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  const iso = isoNow();
  return iso < START ? START : iso > END ? END : iso;
}

/** 0 before the challenge starts, 1-30 during it, 30 after it ends. */
export function dayNumber(): number {
  const iso = isoNow();
  if (iso < START) return 0;
  if (iso > END) return CHALLENGE_DAYS;
  return Number(iso.slice(8, 10));
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function streakOf(days: Record<string, number>): number {
  let cursor = todayISO();
  if (!days[cursor] || days[cursor] < DAILY_TARGET) cursor = shiftDay(cursor, -1);
  let n = 0;
  while (cursor >= START && days[cursor] >= DAILY_TARGET) {
    n += 1;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

export const fmt = (n: number): string => n.toLocaleString("en-AU");
