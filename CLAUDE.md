# Forge — notes for whoever works on this next

Forge is a personal fitness coach app built for one person (the repo owner). It
installs to the iPhone Home Screen and works offline. Read this before changing
anything.

## Who it's for and what they asked for

- Goals: get bigger, stronger and more aesthetic (V-taper, balanced physique).
  Units are **pounds and inches**.
- Not technical. Explain changes in plain language. They test on a real iPhone.
- Hard rules they set:
  - **Completely free.** No API keys or paid services. Hosting is Vercel's free
    tier.
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
  server, no account. Profile has export/import backup.
- Commands: `npm run dev`, `npm test` (Vitest, 35 tests), `npm run build`.
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
- `timed` exercises log seconds in the reps field (planks, carries, hangs).
- Goals are ordered by priority. `physique` anywhere in the top three turns on
  the aesthetic extras (side delts, back width, upper chest, arms) in
  `generator.ts`; `strength` as a secondary goal makes main lifts 5–8 reps.
- Changing profile answers does not change the program. The user rebuilds it
  from Program → "Rebuild from my profile" and reviews it.
- The coach reply can end with a `forge-changes` JSON block (swap, sets, add,
  remove, rest). Each change is shown for approval; exercise and day names must
  match exactly.

## Known gaps and ideas

- The coach can't change the weekly schedule or set weights; weights always come
  from the progression engine.
- There is an `athletic` goal value that only makes main lifts heavier; the
  owner meant "aesthetic", so no explosive/athletic training was built.
- No sync between devices; backup is a manual file.
