# Qadam Parent MVP

Qadam is a dependency-free bilingual web platform that gives parents clear home exercises matched to their child's current skills. The active product contains one adaptive catalogue of 120 exercises in Kazakh and Russian.

## Parent Flow

1. A parent chooses Kazakh or Russian and creates one child profile.
2. Sixteen short questions establish a separate starting level for eight skill areas. Every question has its own relevant answer choices.
3. Qadam prepares exactly three exercises for the day, with no more than one new exercise.
4. Every exercise shows what to prepare, the exact phrase to say, three actions, how often to repeat, the expected result, the benefit, and when to stop.
5. After each exercise, the parent chooses one outcome: independent, assisted, unable, or refused. Qadam immediately selects and opens the next exercise from the 120-exercise catalogue using that result.
6. As soon as the third result is saved, Qadam prepares the next day's three exercises using the completed outcomes.
7. The Summary screen shows the child's name, the next day number, all three prepared exercises, and one clear Open button. Parents never need to search the catalogue for the assigned plan.
8. A short reassessment becomes available after 14 days.

The diagnosis remains part of the child profile but is not used as a diagnosis engine. Qadam is educational support, not a diagnostic or medical service.

## Exercise Catalogue

- 120 exercises across eight categories
- 15 exercises per category
- Five exercises at each of levels 1, 2, and 3
- Complete Kazakh and Russian parent instructions
- Search, category and level filters, favorites, and full exercise details

The source catalogue is `src/data/exercises.ts`. `scripts/compile-exercises.mjs` validates and compiles it into the browser-ready bilingual `src/data/exercises.js`.

## Architecture

- `index.html` is the browser entry point and loads the locally bundled Lucide icon library.
- `src/app.js` owns the small router, landing page, language choice, child profile, and application shell.
- `src/adaptive-flow.js` owns assessment, daily plans, outcomes, catalogue, progress, and profile screens.
- `src/lib/recommendation-engine.js` selects the daily sequence, adapts each upcoming exercise immediately to the latest result, and prepares the next day.
- `src/lib/progress-engine.js` calculates skill levels and applies parent outcomes.
- `src/lib/adaptive-state.js` validates stored adaptive progress and date keys.
- `src/storage.js` is the local persistence adapter and removes obsolete state during migration.
- `supabase/schema.sql` is an authenticated, RLS-protected future backend schema. It is not connected to the current static app.

## Local Use

```bash
npm run serve
```

Open `http://127.0.0.1:3000`.

Run the complete quality check with:

```bash
npm run verify
```

This compiles all exercises, checks JavaScript and deployment wiring, runs the focused automated tests, and builds `dist/`.

## Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Other

`vercel.json` preserves direct SPA links and applies a strict Content Security Policy plus standard browser security headers. Production code does not download executable code from GitHub or third parties.

## Data And Privacy

The current MVP stores the child profile and progress in that browser only. A shared Qadam link never contains another child's data. Clearing browser data removes the profile, and a second device starts with a clean profile.

Cross-device accounts require Supabase Auth and a storage adapter that syncs the existing local state to the RLS-protected tables in `supabase/schema.sql`. Only the Supabase URL and publishable key may be used in browser code. Secret and service-role keys must never be exposed.
