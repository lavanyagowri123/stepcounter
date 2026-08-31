# Steptember 2026 — team step board

A mobile-first leaderboard for a seven-person Steptember challenge (1–30
September 2026, 10,000 steps/day target, team goal 2,100,000 steps). Built
with Next.js (App Router, TypeScript) and Vercel Blob for storage.

The roster is fixed and hardcoded in [`lib/roster.ts`](lib/roster.ts) — there
is no sign-up flow, no auth, and no admin UI.

## How it works

- Everyone picks their name from seven pills; the choice is remembered in
  `localStorage` on that device.
- Each person logs one number of steps per day. Saving the same (name, date)
  pair again **replaces** the value — it never adds to it.
- The leaderboard, streaks, pace marker and the Melbourne→Sydney team journey
  are all derived from the stored per-day totals — nothing else to configure.

## Data layer

Steps are stored in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
as one JSON file per person at `steptember2026/<slug>.json`, e.g.
`steptember2026/lavanya.json`:

```json
{ "2026-09-01": 8421, "2026-09-02": 11002 }
```

- Names are slugified (lowercase, non-alphanumerics → hyphens) before they
  ever touch a path — never a path with a space in it.
- One file per person means two people saving at the same time write to two
  different blobs and can't clobber each other.
- Blob is CDN-backed, so reads go through `@vercel/blob`'s `get(..., { useCache: false })`,
  which fetches straight from origin storage instead of a (possibly stale)
  edge cache.
- All Blob access happens in the `/api/steps` route handlers
  ([`app/api/steps/route.ts`](app/api/steps/route.ts)), which run server-side
  only. The browser never talks to Blob directly, and Blob URLs are never
  exposed to the client.

### API

- `GET /api/steps` — returns `{ entries: { [name]: { [date]: steps } } }` for
  the whole roster.
- `POST /api/steps` — body `{ name, date, steps }`. Upserts one day. Returns
  `{ name, days }` (that person's full day map) on success, or `400 { error }`
  if `name` isn't on the roster, `date` falls outside 1–30 September 2026, or
  `steps` isn't an integer between 0 and 120,000.
- `DELETE /api/steps` — body `{ name, date }`. Removes one day, same
  validation and response shape as `POST`.

## Local development

```bash
npm install
```

You need a Blob store token to run this locally (the board calls Blob on
every load). Easiest path:

1. Install the Vercel CLI if you don't have it: `npm install -g vercel`.
2. Link this project to a Vercel project: `vercel link`.
3. Create a Blob store (Vercel dashboard → Storage → Create → Blob, or
   `vercel blob store add`) and connect it to the project. Choose **Private**
   access — everything in this app reads and writes Blob only from
   server-side route handlers, which hold the token, so there's no reason to
   let anyone with a leaked URL read a blob without it.
4. Pull the store's token into a local env file: `vercel env pull .env.local`.
   (Or copy `.env.example` to `.env.local` and paste the token in yourself.)

```bash
npm run dev
```

Open `http://localhost:3000` — it's a single mobile-width page, so a phone
device toolbar in devtools is the realistic way to view it, though it works
at any width.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Yes | Read-write token for the Vercel Blob store. Set automatically when a Blob store is connected to the Vercel project; for local dev, pull it with `vercel env pull .env.local`. |

There's nothing else to configure — the roster, colours, dates and targets
are constants in `lib/roster.ts`, not environment-driven.

## Deploying to Vercel

1. Push this repo to GitHub (or your Git provider of choice) and
   [import it into Vercel](https://vercel.com/new), or run `vercel` from the
   project root if you've already linked it.
2. In the Vercel project, go to **Storage → Create Database → Blob** and
   create a store, then connect it to the project. This sets
   `BLOB_READ_WRITE_TOKEN` in the project's environment variables
   automatically — no manual copying needed for the deployed app.
3. Deploy (`git push` to your production branch, or `vercel --prod`).

No other configuration, database, or build step is required — the Next.js
build (`next build`) is what Vercel runs by default.
