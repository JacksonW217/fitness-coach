# Forge — personal fitness coach

A private, installable iPhone web app: onboarding → personalized program → live workout logging → deterministic progressive-overload engine → dashboard and progress tracking.

- **Free to run.** Static site on Vercel's free tier. No server, no database account, no API keys.
- **Your data stays on your phone** (IndexedDB). Use *Profile → Back up now* regularly; deleting the Home Screen icon deletes the data.
- **No AI required.** Program generation, progression, plateau/fatigue detection and coaching insights are rule-based and work offline. AI coaching via your Claude app arrives in phase 2.

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
| `src/data/exercises.ts` | Exercise library (equipment, stresses, technique cues) |
| `src/screens/` | Onboarding, Today, Program, Workout, Progress, Profile |
| `src/db.ts` | IndexedDB schema, backup/restore |

## Roadmap

1. ✅ Onboarding, program generator, workout logging, progression engine, dashboard, body-weight tracking
2. Ask Claude (copy-to-Claude coaching using your data), Optimize My Workout (time + readiness)
3. Program adaptation recommendations, nutrition and recovery tracking
