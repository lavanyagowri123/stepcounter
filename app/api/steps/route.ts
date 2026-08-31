import { NextResponse } from "next/server";
import { isRosterName, isWithinWindow, MAX_STEPS } from "@/lib/roster";
import { readAll, readPerson, writePerson } from "@/lib/steps-store";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    const entries = await readAll();
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the board." },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const { name, date, steps } = (body ?? {}) as Record<string, unknown>;

  if (!isRosterName(name)) return badRequest("Unknown name — pick one of the roster.");
  if (!isWithinWindow(date)) return badRequest("Date must fall within 1–30 September 2026.");
  const n = typeof steps === "number" ? steps : Number(steps);
  if (!Number.isInteger(n) || n < 0 || n > MAX_STEPS) {
    return badRequest(`Steps must be a whole number between 0 and ${MAX_STEPS.toLocaleString("en-AU")}.`);
  }

  try {
    const days = await readPerson(name);
    days[date] = n;
    await writePerson(name, days);
    return NextResponse.json({ name, days });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save that entry." },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const { name, date } = (body ?? {}) as Record<string, unknown>;

  if (!isRosterName(name)) return badRequest("Unknown name — pick one of the roster.");
  if (!isWithinWindow(date)) return badRequest("Date must fall within 1–30 September 2026.");

  try {
    const days = await readPerson(name);
    delete days[date];
    await writePerson(name, days);
    return NextResponse.json({ name, days });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not remove that entry." },
      { status: 502 }
    );
  }
}
