# Qadam Parent MVP

Qadam is a dependency-free bilingual web platform for parents of children with speech and developmental concerns. It now combines an adaptive catalogue of 120 home exercises with the existing 12 guided lessons in Kazakh and Russian.

## Parent Flow

1. A parent chooses Kazakh or Russian and creates one child profile.
2. Sixteen short questions establish a separate starting level for eight skill areas.
3. Qadam prepares exactly three exercises for the day, with no more than one new exercise.
4. The exercise screen shows only the title, required item, three steps, and the next button.
5. After all three exercises, the parent selects one outcome for each: independent, assisted, unable, or refused.
6. The next plan adapts to those outcomes. Refusal does not lower a level, and repeated difficulty produces an easier choice.
7. A short reassessment becomes available after 14 days.

The diagnosis remains part of the child profile but is not used to choose exercises. Qadam is educational support, not a diagnostic or medical service.

## Exercise Catalogue

- 120 exercises across eight categories
- 15 exercises per category
- Five exercises at each of levels 1, 2, and 3
- Complete Kazakh and Russian parent instructions
- Search, category and level filters, favorites, and full exercise details

The source catalogue is src/data/exercises.ts. scripts/compile-exercises.mjs validates and compiles it into the browser-ready bilingual src/data/exercises.js.

## Architecture

- index.html is the browser entry point.
- src/app.js keeps the existing router and 12-lesson flow.
- src/adaptive-flow.js owns the new assessment, daily plan, outcomes, catalogue, result, and profile screens.
- src/lib/recommendation-engine.js selects the three daily exercises.
- src/lib/progress-engine.js calculates skill levels and applies parent outcomes.
- src/lib/adaptive-state.js validates stored adaptive progress.
- src/storage.js is the local persistence adapter.
- src/data.js contains the original 12 bilingual lessons.
- supabase/schema.sql is an authenticated, RLS-protected future backend schema. It is not connected to the current static app.

## Local Use

~~~bash
npm run serve
~~~

Open http://127.0.0.1:3000.

Run the complete quality check with:

~~~bash
npm run verify
~~~

This compiles all 120 exercises, checks JavaScript and deployment wiring, runs the automated tests, and builds dist/.

## Vercel

- Build command: npm run build
- Output directory: dist
- Framework preset: Other

vercel.json preserves direct SPA links and applies a strict Content Security Policy plus standard browser security headers. Production code does not download executable code from GitHub or third parties.

## Data And Privacy

The current MVP stores the child profile and progress in that browser only. A shared Qadam link never contains another child's data. Clearing browser data removes the profile, and a second device starts with a clean profile.

Cross-device accounts require Supabase Auth and a storage adapter that syncs the existing local state to the RLS-protected tables in supabase/schema.sql. Only the Supabase URL and publishable key may be used in browser code. Secret and service-role keys must never be exposed.
