export const TEAM = ["Lavanya", "Luke", "Marcus", "Seema", "Tantis", "Tracey"] as const;
export const ROSTER = TEAM;

export type Person = (typeof ROSTER)[number];

export const HUE: Record<Person, string> = {
  Lavanya: "#FF4D6D",
  Luke: "#FF8A3D",
  Marcus: "#FFC93C",
  Seema: "#3DDC84",
  Tantis: "#2BC8D9",
  Tracey: "#7B8CFF",
};

export const DAILY_TARGET = 10000;
export const CHALLENGE_DAYS = 30;
export const START = "2026-09-01";
export const END = "2026-09-30";
export const STEP_METRES = 0.75;
export const MAX_STEPS = 120000;
export const TEAM_GOAL = TEAM.length * CHALLENGE_DAYS * DAILY_TARGET;

export const ME_KEY = "steptember2026-me";

/** Lowercase, non-alphanumerics to hyphens — never let a name produce a path with spaces. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isRosterName(name: unknown): name is Person {
  return typeof name === "string" && (ROSTER as readonly string[]).includes(name);
}

export function isWithinWindow(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= START && date <= END;
}
