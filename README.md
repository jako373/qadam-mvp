# Qadam Parent MVP

Qadam is a polished bilingual MVP for parents of children with speech and developmental concerns. It runs as a dependency-free static web app, so it is simple to deploy on Vercel and safe to demo before a backend is connected.

## What Is Included

- Kazakh and Russian language flow
- Child profile onboarding with only allowed select-based developmental fields
- Parent support screen before the first lesson
- Lesson 1 with four activities, 20-minute timer, pause/resume, refresh persistence, and completion checks
- Star-only assessment with required answers
- Adaptive pathway selection from individual question scores
- Four personalized Lesson 2 variants
- Dashboard, lessons, progress, and profile pages
- Route protection for locked lessons and result pages
- Reset demo flow with confirmation
- Vercel static deployment config
- Supabase-ready SQL schema with RLS policies

## Local Launch

1. Open this folder in a terminal.
2. Run:

```bash
npm run serve
```

3. Open:

```txt
http://localhost:3000
```

This local server mirrors the Vercel route fallback, so direct links like `/lesson/lesson1` work during testing.

## Project Structure

```txt
index.html
src/
  app.js
  data.js
  pathway.js
  storage.js
  styles.css
public/
  images/
    parent-child-lesson.svg
supabase/
  schema.sql
vercel.json
.env.example
```

## Adaptive Lesson Logic

Lesson 1 assessment stores five separate scores:

- interactionScore = question 1
- understandingScore = question 2
- requestScore = question 3
- speechScore = question 4
- regulationScore = question 5

Priority order:

1. Interaction and shared play when `interactionScore <= 2 || regulationScore <= 2`
2. Understanding and requesting when `understandingScore <= 2 || requestScore <= 2`
3. First functional words when `speechScore <= 3`
4. Combining words otherwise

The selected pathway unlocks only the matching Lesson 2 variant.

## How To Add New Lessons

1. Add lesson content in `src/data.js`.
2. Add the lesson id to the lesson list in `src/app.js`.
3. Add unlock rules where progress is updated after an assessment.
4. Keep assessments star-only unless the product requirement changes.

## Vercel Deployment

This app is intentionally static. On Vercel:

- Framework preset: Other
- Build command: leave empty
- Output directory: leave empty or use project root
- Install command: not required

`vercel.json` handles:

- clean URLs
- SPA fallback for direct route access
- cache headers for the generated image
- basic security headers

Do not put Supabase secrets in `vercel.json`. Use Vercel Project Settings for environment variables later.

## Supabase Plan

The current MVP uses localStorage for demo speed. Later, replace localStorage with Supabase:

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Add browser-safe Supabase variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

The schema enables RLS for parent and child data. Each parent can only access their own rows.

## Current Deployment Risk Notes

- There was no existing GitHub repo in this workspace to audit.
- Vercel account is connected, but there are no projects yet.
- Supabase account is connected, but there are no projects yet.
- npm registry access failed in this environment, so the MVP avoids external dependencies.
- Because there is no backend connected yet, production user data must not be treated as synced or recoverable.
