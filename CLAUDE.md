# Forge — notes for whoever works on this next

Forge is a personal fitness coach app built for one person (the repo owner). It
installs to the iPhone Home Screen and works offline. Read this before changing
anything.

## Who it's for and what they asked for

- Goals: get bigger, stronger and more aesthetic (V-taper, balanced physique).
  Units are **pounds and inches**.
- Not technical. Explain changes in plain language. They test on a real iPhone.
- Hard rules they set:
  - **Completely free.** No paid services. Hosting is Vercel's free tier. The
    one exception the owner approved (Nov 2026) is lock-screen rest alerts, which
    use two tiny Vercel functions and Upstash QStash's free plan; see below.
  - **Claude coaching happens in the owner's own Claude app by copy and paste**
    (they have a Pro plan). The app never calls an AI API.
  - **Never invent numbers.** With no logged history for an exercise the app
    suggests no weight. Every weight increase is confirmed by the user.
  - The app never silently changes the program: changes are proposed and
    approved (or applied automatically only within the user's adapt settings).
- Look: dark theme with a purple accent (changed from the original white/black
  at the owner's request). The icon is liked as is.

## How it's built

- Vite + React 19 + TypeScript, `vite-plugin-pwa`. Static site on Vercel; a push
  to `main` redeploys.
- All data is in IndexedDB (Dexie, `src/db.ts`) **on the device only**. No
  account. Profile has export/import backup. The only server code is the rest
  alert functions in `api/`; they store nothing.
- Commands: `npm run dev`, `npm test` (Vitest), `npm run build`.
  `tsconfig.tsbuildinfo` is tracked and changes on every build; commit it with
  your change.
- Testing UI: `npx vite preview` + Playwright with the `iPhone 13` device.
  Onboarding must be completed first in a fresh browser.

## Where things are

| Path | What |
| --- | --- |
| `src/data/exercises.ts` | ~130 built-in exercises; `registerCustomExercises` merges user-made ones |
| `src/engine/generator.ts` | Builds a program from the profile (split, slots, sets/reps, fit to time) |
| `src/engine/progression.ts` | Double progression and weight recommendations from logged history |
| `src/engine/optimizer.ts` | Shrinks/adjusts today's workout for time and readiness |
| `src/engine/adaptation.ts` | Program review proposals (stalls, volume, deloads); capped at 4 |
| `src/engine/coach.ts` | Builds the Claude prompt; parses the `forge-changes` block from the reply |
| `src/engine/nutrition.ts`, `recovery.ts`, `insights.ts` | Targets, readiness, trends |
| `src/screens/Workout.tsx` | Logging a session (the most complex screen) |

## Conventions that matter

- Everything in `src/engine` is deterministic and unit-tested. Keep it that way:
  no randomness, no AI, no invented data.
- **Custom exercises** are stored in the `customExercises` table and merged into
  `EXERCISES` / `EXERCISE_MAP` at startup (`loadCustomExercises` in `main.tsx`)
  so every engine treats them like built-ins. Removed ones are `archived`, not
  deleted, so history still resolves. Exercise ids are keys in saved history:
  **never rename an id**.
- Exercises are reordered by dragging (`src/components/DragList.tsx`), both in
  Program → day and in a workout (Reorder button / exercise menu). Every drag in
  a workout can be undone.
- `timed` exercises log seconds in the reps field (planks, carries, hangs).
- Goals are ordered by priority. `physique` anywhere in the top three turns on
  the aesthetic extras (side delts, back width, upper chest, arms) in
  `generator.ts`; `strength` as a secondary goal makes main lifts 5–8 reps.
- Changing profile answers does not change the program. The user rebuilds it
  from Program → "Rebuild from my profile" and reviews it.
- The coach reply can end with a `forge-changes` JSON block (swap, sets, add,
  remove, rest). Each change is shown for approval; exercise and day names must
  match exactly.

## Rest-timer notifications (`api/`, `src/lib/push.ts`)

- A locked iPhone freezes the app, so a timer can't fire from the phone. When a
  rest starts, the app POSTs to `api/rest-timer`, which asks QStash to call
  `api/send-push` at the end time; that verifies QStash's signature and sends a
  Web Push to the phone. `public/push-handler.js` (imported into the service
  worker) shows it. Exactly one alert is kept scheduled per timer; skip, pause,
  finish, discard and timer changes cancel or replace it. Leaving the workout
  screen does not.
- Vercel env vars needed: `VAPID_PRIVATE_KEY`, `QSTASH_TOKEN`,
  `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (and `QSTASH_URL` if
  Upstash gives one). The VAPID public key is in `api/_shared.ts`; changing the
  key pair means every phone must turn alerts off and on again.
  `GET /api/rest-timer` reports which are set (booleans only); Profile shows it.
- iPhone rules: only for Home Screen apps, iOS 16.4+, and permission must be
  requested from a tap (`enablePush` is called directly in tap handlers).
- `web-push` v4 is ESM with named exports only: `import { sendNotification }`.
- Files in `api/` starting with `_` are not deployed as functions. Tests in
  `api/_functions.test.ts` verify signature checks and the encrypted push.

## Known gaps and ideas

- The coach can't change the weekly schedule or set weights; weights always come
  from the progression engine.
- There is an `athletic` goal value that only makes main lifts heavier; the
  owner meant "aesthetic", so no explosive/athletic training was built.
- No sync between devices; backup is a manual file.
