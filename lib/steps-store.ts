import "server-only";
import { put, get as blobGet } from "@vercel/blob";
import { ROSTER, slugify, type Person } from "./roster";

export type DayMap = Record<string, number>;

const PREFIX = "steptember2026";

function pathFor(name: Person): string {
  return `${PREFIX}/${slugify(name)}.json`;
}

/**
 * Blob is CDN-backed by default. useCache: false forces a read straight from
 * origin storage — without it, a save from one device can be invisible to
 * everyone else for as long as the edge cache holds the old file.
 */
export async function readPerson(name: Person): Promise<DayMap> {
  const result = await blobGet(pathFor(name), { access: "private", useCache: false });
  if (!result) return {};
  const text = await new Response(result.stream).text();
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as DayMap) : {};
  } catch {
    return {};
  }
}

export async function readAll(): Promise<Record<Person, DayMap>> {
  const entries = await Promise.all(ROSTER.map((name) => readPerson(name).then((days) => [name, days] as const)));
  return Object.fromEntries(entries) as Record<Person, DayMap>;
}

/** One file per person — a write here can never clobber another person's file. */
export async function writePerson(name: Person, days: DayMap): Promise<void> {
  await put(pathFor(name), JSON.stringify(days), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}
