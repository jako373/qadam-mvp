# Center Parent Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give center parents independent assessment and daily practice without specialist assignment or email registration.

**Architecture:** Reuse the existing adaptive UI, recommendation engine and parent assessment/plan/attempt tables. Keep `/family` as the home workspace, allow only practice routes, and hydrate the linked child before entering them. Never copy parent results into specialist assessments or homework responses.

**Tech Stack:** Existing JavaScript ES modules, node:test, Supabase REST/RLS, existing Playwright tooling. No new production dependency.

**Spec:** `docs/superpowers/specs/2026-11-24-center-parent-practice-design.md` (approved by user).

## Global Constraints

- Do not change attendance, payments, roles, passwords or existing homework behavior.
- No duplicate child/account, no automatic account merging, no mandatory email registration.
- Preserve existing email-parent behavior and all existing records.
- Kazakh/Russian; desktop/mobile; account and child access validated server-side.
- Prepare only additive migrations if necessary; do not apply or publish without a separate command.

## Review Focus

- A failed hydration must not show another account's cached child or assessment.
- A delayed save after account switching must not write the previous account's state under the new account.
- A parent without a personal assessment must not inherit an older browser assessment or be treated as professionally assessed.
- An empty assignment list must not block independent practice or imply completion.
- Specialist summary access must reject unassigned children and other centers, even through direct API calls.

### Task 1: Allow practice routes without opening other workspaces

**Files:** `src/lib/workspace-routes.js`, `src/auth-entry.js`, `src/family-dashboard.js`, `tests/workspace-routes.test.js`, `tests/center-homework.test.js`.

**Interfaces:** Preserve `homeDestination(session,membership,hasProfile)` and `workspaceRedirect(path,session,membership,parentDestination)`. Export `isCenterPracticeRoute(path)` for the bootstrap's second guard. Allow `/today`, `/progress`, `/skill-check`, `/skill-check/1` through `/skill-check/16`, `/daily/1` through `/daily/3`, `/daily-results/1` through `/daily-results/3`, `/daily-summary`; inspect reassessment routing before deciding whether it belongs in the same allowlist. Keep all other center-parent routes redirected to `/family`.

- [ ] Add failing route tests: allowed practice routes return null; `/admin`, `/center`, `/onboarding`, `/subscription` and malformed exercise routes return `/family`; specialist restrictions remain unchanged.
- [ ] Add family-render tests: independent practice entry exists without homework; existing homework controls remain available when assigned.
- [ ] Run `node --test tests/workspace-routes.test.js tests/center-homework.test.js`, observe the missing behavior, then implement the allowlist and two bilingual family entries.
- [ ] Add a visible return to `/family` from practice screens using existing account controls. Do not modify general app-home routing for email parents.
- [ ] Rerun the focused tests; inspect the diff and commit only task files locally.

### Task 2: Hydrate and sync only the current parent's linked child

**Files:** `src/auth-entry.js`, `src/storage.js` only if required to invalidate its in-memory cache, `tests/auth-route-bootstrap.test.js`, new `tests/parent-practice-sync.test.js`.

**Interfaces:** Keep `hydrateState(session)`, `syncState(state)` and `scheduleSync(state)`. Bind a captured sync job to its session user ID and server-resolved child ID; reject a changed session rather than reusing the pending state under another user. Use the existing bootstrap-test import harness with controlled REST responses.

- [ ] Add failing bootstrap tests: a center parent with no parent assessment gets empty answers despite stale local state; a failed child/assessment query renders retry UI without importing the practice app; another account's child ID is ignored.
- [ ] Add failing sync tests: captured job/session mismatch makes zero writes; center-parent sync makes no child-profile upsert and no new child UUID; successful parent assessment/plan/attempt writes use the server-linked child ID only.
- [ ] Hydrate strict center-parent state from server data, not merged browser data. Preserve an account-and-child-scoped pending draft only for the same identity, and surface conflicts rather than overwriting server work silently. Keep specialist assessments separate.
- [ ] Make sync failure visible with retry; retain the same-identity pending state until successful persistence. Do not mark failed writes as synced. Cancel or reject pending jobs at logout/account changes.
- [ ] Run focused bootstrap/sync tests plus existing storage and adaptive tests; commit the verified task locally.

### Task 3: Show specialist a bounded independent-practice summary

**Files:** `src/center-dashboard.js`, new `tests/center-parent-practice.test.js`; one new Supabase migration if current RLS does not already provide the required narrowly scoped access.

**Interfaces:** Proposed `rpc/center_parent_practice_summary` with `p_center_id uuid`, `p_child_id uuid`, returning parent-assessment date, attempt count and at most 10 recent attempts (exercise/category/outcome/date). Do not return parent contact details, assessment answers or unrelated children.

- [ ] Inspect existing parent-table grants and RLS definitions read-only before authoring schema changes. Reuse existing protected access if it already satisfies this interface.
- [ ] Add failing dashboard tests for the distinct independent-family-activity section, empty activity and an unavailable-summary error state. Verify that no homework response or specialist assessment is changed.
- [ ] If needed, create a migration using the available Supabase CLI's documented migration command. Its function must validate `auth.uid()`, center role and `private.center_can_view_child`; revoke anonymous/default public execution and limit returned history. Do not apply it.
- [ ] Add a rollback-only SQL acceptance script for allowed specialist/admin, unrelated specialist, other center, parent and anonymous subjects; leave it unexecuted on hosted data until authorized. State that runtime database verification is pending.
- [ ] Render the scoped summary in the existing child plan with explicit source labeling and date. Rerun focused tests; commit locally.

### Task 4: Verify the complete flow and hand off without publishing

**Files:** a synthetic browser fixture and runnable browser check under the existing tests/scripts conventions; a short implementation report under `docs/`.

- [ ] Test both languages at 1440px and 375px: center parent with no assignment → 16 questions → daily plan → exercise result; reload with server-returned data; existing specialist assignment still usable; return to `/family`.
- [ ] Test a fresh browser context with the same simulated server records, and switching to a different account in the same browser. Include hydration and write failures. Use no real child data or credentials in fixtures, screenshots or commits.
- [ ] Run `npm run verify` and the runnable browser check. Inspect screenshots and horizontal overflow. Report every failure or unverified hosted boundary explicitly.
- [ ] Review the diff against exclusions and remove needless abstractions/dependencies. Preserve unrelated dirty/untracked user files.
- [ ] Summarize reused components, additions, tests, any required migration and publication status. No push, merge, hosted migration or production deployment in this implementation task.

## Execution proposal

Implement natively in this session; this is one tightly connected authentication/state/UI integration. An independent whole-diff review follows implementation. A per-task subagent workflow is an alternative if the user prefers it. Await execution-method confirmation before product-code changes.
