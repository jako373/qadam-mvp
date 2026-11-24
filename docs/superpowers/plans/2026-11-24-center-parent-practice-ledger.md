# SDD ledger — plan: docs/superpowers/plans/2026-11-24-center-parent-practice.md

Base: a53f2c0. Existing linked worktree verified; branch agent/center-parent-practice.
Pre-flight: Tasks 1/2 share route bootstrap; hydration must complete before importing app.js. Task 3 reads parent tables, never homework responses. Task 4 consumes the real bootstrap and database-shaped fixtures.
Ruling: Keep this small ledger using native file edits rather than shell-generated briefs in Windows; the approved plan is the task brief. No runtime behavior changes from this tooling choice.
Ruling: Isolate center-parent persistence in a small tested module; leave legacy email-parent hydration/sync unchanged. This avoids a broad authentication refactor; legacy email sync retains its existing behavior.
Ruling: Actual adaptive routes are /plan-ready and /recheck/1..8, not /reassessment. Tests and allowlist use actual routes.
Task 1: complete — route and family UI regressions observed RED then GREEN.
Task 2: complete — strict identity hydration, append-only idempotent inserts, scoped pending draft, retry and in-flight-draft preservation tested. Parent-table permissions and composite child/parent foreign keys inspected read-only in hosted database.
Ruling: Partial questionnaire answers remain in an explicitly labeled account/child-scoped local draft until full assessment; completed assessments/plans/results synchronize across devices. Cross-device partial-answer drafts are outside the specified completed-assessment acceptance case.
Task 3: complete locally — specialist summary UI and proposed owner-checked RPCs prepared; no hosted schema changes.
Task 4: complete locally — browser checks passed kk/ru at 1440/375 with actual bootstrap and synthetic API. Covers authoritative server titles, empty catalogue, write failure/retry, cross-device conflict, server-version recovery, account switch, hydration failure.
Final review: fresh read-only reviewer parent_practice_review, gpt-6.2-astra; eac54c8 rejected pending fixes.
Final: fixed cross-account storage/scheduler/render leak — owner-isolation and six account-direction/logout tests RED→GREEN.
Final: fixed stale whole-snapshot overwrites — atomic snapshot/revision-checked save RPC proposal; stale save and retry test RED→GREEN.
Final: fixed catalogue/module/age mismatch — strict single-module catalogue and eligibility checks; route/catalogue unit checks and distinct-server-title browser checks.
Final: fixed reassessment loss — typed completed reassessment stored/restored, source/date distinct from initial.
Final: fixed fabricated/lifetime attempt regression — authoritative counters preserved, baseline display events excluded from new events, exercise+normalized-time event IDs; tests include 25,000 historical attempts.
Final: fixed no-op draft deletion and retry-button mobile obstruction — reproducible tests RED→GREEN; full suite 152/152.
Final: Ruling: Atomic parent snapshot/save RPCs are necessary in addition to the summary RPC; a client-only read-then-write cannot safely prevent lost updates. Cost: the additive proposed SQL must be reviewed/applied and its synthetic-role SQL test run before production release.
Final: Ruling: Keep independent SQL acceptance tests unexecuted because schema changes were not authorized; browser uses a synthetic atomic API. Cost: no claim of hosted integration readiness until migration and SQL verification.
Final: Ruling on declined clinical/translation suitability: this change reuses existing exercises/text and makes no clinical claims. Specialist retains professional decision-making; clinical review of the existing exercise bank is not performed here.
Final: minor deferred: none. No reviewer re-dispatch after fix pass.
Contract gate: no new production dependencies or duplicate recommendation engine; retain identity/revision/draft safeguards. Lean already.
