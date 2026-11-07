# Forge — personal fitness coach

A private, installable iPhone web app: onboarding → personalized program → live workout logging → deterministic progressive-overload engine → dashboard and progress tracking.

- **Free to run.** Static site on Vercel's free tier. No server, no database account, no API keys.
- **Your data stays on your phone** (IndexedDB). Use *Profile → Back up now* regularly; deleting the Home Screen icon deletes the data.
- **No AI API required.** Program generation, progression, workout optimization, plateau/fatigue detection and coaching insights are rule-based and work offline. The AI coach runs in your own Claude app: Forge copies a snapshot of your real data, you paste it into a Claude Project, and paste the answer back. Proposed program changes are validated and applied only after you approve them.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests
npm run build    # production build in dist/
```

## Deploy (Vercel)

Import this repo at vercel.com → New Project. Defaults work (framework: Vite, build `npm run build`, output `dist`). Every push to `main` redeploys.

## Install on iPhone

Open the Vercel URL in **Safari** → Share → **Add to Home Screen**.

## Structure

| Path | What |
|---|---|
| `src/engine/progression.ts` | Double progression, deload/plateau/decline detection, warm-ups, PRs |
| `src/engine/generator.ts` | Split selection, exercise selection, sets/reps/rest, time fitting |
| `src/engine/insights.ts` | Dashboard coaching insights from real data |
| `src/engine/optimizer.ts` | Optimize My Workout: time/readiness/soreness restructuring with explanations |
| `src/engine/coach.ts` | Claude prompt builder, project instructions, change parser/validator |
| `src/engine/adaptation.ts` | Program review: volume, stalls, deloads, consistency, session length, calories; auto-mode bounds |
| `src/engine/nutrition.ts` | Calorie/macro targets (Mifflin-St Jeor), daily totals |
| `src/engine/recovery.ts` | Daily check-in readiness score |
| `src/data/exercises.ts` | Exercise library (equipment, stresses, technique cues) |
| `src/screens/` | Onboarding, Today, Program, Workout, Progress, Profile |
| `src/db.ts` | IndexedDB schema, backup/restore |

## Roadmap

1. ✅ Onboarding, program generator, workout logging, progression engine, dashboard, body-weight tracking
2. ✅ Coach tab (Claude Project bridge with history + approvable changes), Optimize My Workout
3. ✅ Program review (recommend or bounded automatic mode, deload weeks), nutrition logging with targets, daily recovery check-ins
