"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DAILY_TARGET,
  CHALLENGE_DAYS,
  HUE,
  ME_KEY,
  MAX_STEPS,
  ROSTER,
  START,
  END,
  TEAM_GOAL,
  type Person,
} from "@/lib/roster";
import { dayNumber, fmt, prettyDate, streakOf, todayISO } from "@/lib/dates";
import { ROUTE, ROUTE_END, km } from "@/lib/journey";

type DayMap = Record<string, number>;
type Entries = Partial<Record<Person, DayMap>>;

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* body wasn't JSON */
  }
  return `Request failed (${res.status})`;
}

export default function StepBoard() {
  const [entries, setEntries] = useState<Entries>({});
  const [me, setMe] = useState<Person | null>(null);
  const [date, setDate] = useState(todayISO());
  const [steps, setSteps] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const day = dayNumber();

  const flash = useCallback((msg: string) => {
    setToast(msg);
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/steps", { cache: "no-store" });
        if (!res.ok) throw new Error(await parseError(res));
        const body = await res.json();
        if (!cancelled) setEntries(body.entries ?? {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the board.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    try {
      const saved = window.localStorage.getItem(ME_KEY);
      if (saved && (ROSTER as readonly string[]).includes(saved)) setMe(saved as Person);
    } catch {
      /* localStorage unavailable — no persisted pick, not fatal */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const pickMe = (name: Person) => {
    setMe(name);
    setSteps("");
    try {
      window.localStorage.setItem(ME_KEY, name);
    } catch {
      /* non-critical — just won't be remembered next visit */
    }
  };

  const save = async () => {
    if (!me) return flash("Pick your name first");
    const n = Math.round(Number(steps));
    if (!Number.isFinite(n) || n < 0) return flash("Enter a number of steps");
    if (n > MAX_STEPS) return flash(`That's over ${fmt(MAX_STEPS)} — check the number`);

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: me, date, steps: n }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const body = await res.json();
      // work on a copy — never mutate the entries object already in state
      setEntries((prev) => ({ ...prev, [me]: body.days as DayMap }));
      setSteps("");

      const st = streakOf(body.days as DayMap);
      if (n >= 20000) flash(`${fmt(n)} on ${prettyDate(date)}. Enormous day.`);
      else if (n >= DAILY_TARGET && st > 1) flash(`${fmt(n)} logged. ${st} days over 10k in a row.`);
      else if (n >= DAILY_TARGET) flash(`${fmt(n)} logged — 10k cleared for ${prettyDate(date)}.`);
      else flash(`${fmt(n)} logged. ${fmt(DAILY_TARGET - n)} short of 10k — a lap of the block covers it.`);
    } catch (err) {
      // do NOT touch entries — the write didn't happen, so local state stays truthful
      setError(err instanceof Error ? err.message : "Could not save that entry.");
    } finally {
      setSaving(false);
    }
  };

  const removeDay = async (iso: string) => {
    if (!me) return;
    setError(null);
    try {
      const res = await fetch("/api/steps", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: me, date: iso }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const body = await res.json();
      setEntries((prev) => ({ ...prev, [me]: body.days as DayMap }));
      flash(`${prettyDate(iso)} removed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that entry.");
    }
  };

  const board = useMemo(() => {
    return ROSTER.map((name) => {
      const days = entries[name] || {};
      const keys = Object.keys(days);
      const total = keys.reduce((s, k) => s + days[k], 0);
      return {
        name,
        total,
        logged: keys.length,
        best: keys.length ? Math.max(...keys.map((k) => days[k])) : 0,
        streak: streakOf(days),
      };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [entries]);

  const leader = board[0]?.total || 0;
  const teamTotal = board.reduce((s, p) => s + p.total, 0);
  const pace = day * DAILY_TARGET;
  const scale = Math.max(leader, pace, DAILY_TARGET);

  const teamKm = km(teamTotal);
  const passed = [...ROUTE].reverse().find((r) => teamKm >= r.km) || ROUTE[0];
  const next = ROUTE.find((r) => r.km > teamKm);

  const myDays = useMemo(() => Object.keys(entries[me as Person] || {}).sort().reverse(), [entries, me]);
  const mine = board.find((p) => p.name === me);
  const myRank = mine ? board.indexOf(mine) : -1;
  const chaser = myRank > 0 ? board[myRank - 1] : null;
  const existingForDate = me && entries[me] ? entries[me]![date] : undefined;

  const headline = () => {
    if (loading) return "Loading the board…";
    if (day === 0) return "Thirty days, six pairs of legs. First entries go in on 1 September.";
    if (teamTotal === 0) return "Nobody has logged a step yet. Someone has to go first.";
    if (mine && mine.total >= pace)
      return `${fmt(mine.total - pace)} ahead of the 10k-a-day pace. Keep it there.`;
    if (mine && mine.total > 0)
      return `${fmt(pace - mine.total)} behind pace — about ${((pace - mine.total) / DAILY_TARGET).toFixed(1)} days to claw back.`;
    return "Pick your name and log a day to join the walk.";
  };

  return (
    <div className="wrap">
      <div className="masthead">
        <h1 className="title">Steptember</h1>
        <span className="daycount">{day === 0 ? "Starts 1 Sept" : `Day ${day} / ${CHALLENGE_DAYS}`}</span>
      </div>
      <p className="headline">{headline()}</p>

      {error && (
        <div className="warn" role="alert">
          <strong>Something didn&rsquo;t save.</strong> {error}
        </div>
      )}

      <div className="card">
        <div className="jtop">
          <span className="jkm">{teamKm.toFixed(1)}</span>
          <span className="junit">km walked</span>
          <span className="jsteps">
            {loading ? "—" : fmt(teamTotal)} steps
            <br />
            of {fmt(TEAM_GOAL)}
          </span>
        </div>
        <div className="road">
          <i style={{ width: `${Math.min(100, (teamKm / ROUTE_END) * 100)}%` }} />
          {ROUTE.map((r) => (
            <span
              key={r.place}
              className={`stop${teamKm >= r.km ? " done" : ""}`}
              style={{ left: `${(r.km / ROUTE_END) * 100}%` }}
              title={r.place}
            />
          ))}
          <span className="walker" style={{ left: `${Math.min(100, (teamKm / ROUTE_END) * 100)}%` }}>
            💃
          </span>
        </div>
        <div className="jfoot">
          <span>Melbourne</span>
          <span>Sydney</span>
        </div>
        <p className="jnext">
          {teamKm >= ROUTE_END ? (
            "You walked to Sydney. Collectively. Start on Brisbane."
          ) : next ? (
            <>
              Past <strong>{passed.place}</strong>. Next stop {next.place}, {(next.km - teamKm).toFixed(1)} km up the
              Hume.
            </>
          ) : (
            ""
          )}
        </p>
      </div>

      <div className="card">
        <p className="cardhead">Log your steps</p>
        <div className="names">
          {ROSTER.map((n) => (
            <button
              key={n}
              type="button"
              className="name"
              aria-pressed={me === n}
              onClick={() => pickMe(n)}
              style={me === n ? { background: HUE[n] } : undefined}
            >
              <span className="dot" style={{ background: HUE[n] }} />
              {n}
            </button>
          ))}
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="d">Date</label>
            <input id="d" type="date" value={date} min={START} max={END} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="s">Steps</label>
            <input
              id="s"
              type="number"
              inputMode="numeric"
              placeholder="8400"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
        </div>
        <button
          type="button"
          className="cta"
          onClick={save}
          disabled={saving || loading || !me || steps === ""}
          style={me ? { background: HUE[me], color: "#141327" } : undefined}
        >
          {saving ? "Saving…" : existingForDate !== undefined ? "Update this day" : "Add steps"}
        </button>
        {existingForDate !== undefined && (
          <p className="hint">
            {prettyDate(date)} already has {fmt(existingForDate)} — saving replaces it.
          </p>
        )}
        {!me && <p className="hint">Tap your name, then log a day. Your pick is remembered on this device.</p>}
      </div>

      <h2>Leaderboard</h2>
      {day > 0 && <p className="sub">The marker on each lane is today&rsquo;s 10,000-a-day pace ({fmt(pace)}).</p>}
      {board.map((p, i) => {
        const behind = i > 0 ? board[i - 1].total - p.total : 0;
        return (
          <div className="lane" key={p.name}>
            <div className="laneTop">
              <span className="pos">{i + 1}</span>
              <span className="who" style={{ color: HUE[p.name] }}>
                {p.name}
              </span>
              {i === 0 && p.total > 0 && <span>👑</span>}
              {p.streak >= 2 && <span className="streak">🔥 {p.streak}</span>}
              {me === p.name && <span className="youtag">you</span>}
              <span className="tot">{fmt(p.total)}</span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${Math.min(100, (p.total / scale) * 100)}%`, background: HUE[p.name] }} />
              {pace > 0 && <div className="tick" style={{ left: `${Math.min(100, (pace / scale) * 100)}%` }} />}
            </div>
            <div className="meta">
              {p.logged === 0 ? (
                "Nothing logged yet"
              ) : (
                <>
                  {p.logged} day{p.logged > 1 ? "s" : ""} · {fmt(Math.round(p.total / p.logged))} avg · best {fmt(p.best)}
                  {behind > 0 && behind <= 15000 && <span className="gap"> · {fmt(behind)} off {board[i - 1].name}</span>}
                </>
              )}
            </div>
          </div>
        );
      })}

      {chaser && mine && mine.total > 0 && (
        <p className="nudge">
          {fmt(chaser.total - mine.total + 1)} more steps and you&rsquo;re past{" "}
          <strong style={{ color: HUE[chaser.name] }}>{chaser.name}</strong>. One decent walk.
        </p>
      )}

      {me && (
        <div style={{ marginTop: 30 }}>
          <h2>{me}&rsquo;s days</h2>
          {myDays.length === 0 && <p className="empty">Nothing logged yet. Add today&rsquo;s count above.</p>}
          {myDays.map((iso) => (
            <div className="log" key={iso}>
              <span>{prettyDate(iso)}</span>
              {entries[me]![iso] >= DAILY_TARGET && <span className="win">10k</span>}
              <b>{fmt(entries[me]![iso])}</b>
              <button type="button" className="del" onClick={() => removeDay(iso)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
