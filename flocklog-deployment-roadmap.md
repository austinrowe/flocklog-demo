# FlockLog — Path to Real Barn Deployment

> **Status note (added later):** this roadmap was written *before* the Supabase
> backend was built, and the "Where this stands today" section below is now out
> of date — it describes the app when everything lived in React state. Phases 1
> and 2 have since been substantially implemented: there is a real Supabase
> project, real auth, and 13 live tables. See `README.md` for current state.
> Phases 0 and 3–6 remain open. The rest of this document still stands.

## Where this stands today

`flocklog.jsx` is a fully client-side demo. Every piece of data — mortality entries, weights, tasks, population counts, barn configs, even accounts — lives in React `useState` and is seeded on page load by `seed*()` functions. There is no backend call anywhere in the file. Sign-in accepts any 4-digit PIN for any listed name — it's a role selector, not authentication.

This is the correct way to build and demo a product before committing to a data model. It is not deployable to a real barn: refresh the page or open a second tablet and the data is gone or invisible to the other device. "Done" for a real pilot means two or more devices logging into the same barn, seeing the same live data, surviving a browser crash, and not letting a worker read or edit another farm's records.

This roadmap gets from here to there.

---

## Phase 0 — Decisions before any code

Mostly not engineering work, but blocks or reshapes every later phase.

- **Pick the Supabase project.** Reuse the one from the earlier React prototype, or start a fresh project scoped to FlockLog. Recommendation: fresh project — the old prototype's schema (if any) doesn't need to constrain this build.
- **Move infra ownership now, not later.** Get a Versova-owned GitHub org, Vercel team, and Supabase org set up before Phase 1 starts writing real data, so nothing has to migrate mid-pilot.
- **Confirm with Kory:** data retention requirements, and whether Versova IT/security wants a review before any real employee data touches a database.
- **Confirm barn wifi reality.** If barns have no reliable wifi, Phase 3 (offline sync) becomes mandatory before any pilot — not a later hardening step.
- **Confirm biosecurity/device policy** for bringing tablets into barns (shower-in/out procedures, allowed device types).
- **Pick pilot scope.** One barn, 1–2 workers, a defined window (1–2 weeks) — validate the schema and RLS policies without district-wide exposure.

---

## Phase 1 — Backend foundation: schema, auth, RLS

The core engineering phase. Everything else depends on this being right.

**Schema.** Tables for `profiles` (id, name, role, farm_id), `farms`, `mortality_entries`, `weight_entries`, `tasks`, `population_snapshots`, `breed_standards`. Foreign keys and CHECK constraints where the current client-side validation lives today (role in a fixed set, uniformity 0–100, etc.) — validation that only exists in JavaScript today is not validation, it's a suggestion.

**Auth strategy — two real options:**
- Supabase Auth with email/magic-link per worker. Most standard, but barn workers on a shared tablet, wearing gloves, mid-shift, may not have convenient email access.
- A custom PIN table: salted + hashed PINs per user, verified server-side via a Postgres function or Edge Function, which then issues a short-lived Supabase session. This keeps the fast tap-in UX you already designed for, while making the PIN actually mean something.

Recommendation: the PIN approach, given the shared-tablet constraint already baked into the UI. Don't force account-per-email onto floor workers to satisfy a generic auth pattern.

**RLS policies** enforcing the existing worker/manager/district model — worker reads/writes only their farm, manager reads across farms but writes only their own, district full access — written as actual Postgres policies referencing the authenticated user, not app-layer `if` statements. This is the fix for the current state, where anyone with dev tools open can already see or edit data they shouldn't, because the permission logic is 100% client-side.

**Triggers** to stamp `created_at` and `user_id` server-side from the session, not from the client payload — right now the client sets both, which means a device can claim any timestamp or any name.

This phase is concept-heavy, not just typing. Expect it to take real focused time, not a single sitting.

---

## Phase 2 — Rewire the app to real data

Mostly mechanical once Phase 1's schema is settled, but touches nearly every component.

- Replace every `seed*()` function and its `useState` array with a Supabase fetch on load plus a realtime subscription or short polling interval.
- Replace `saveWeight`, `logBird`, and every other local-array-spread handler with a Supabase insert.
- Replace CSV export functions to read from live tables instead of in-memory arrays — a small change, since the export logic is already isolated.
- Barn/farm config, accounts, and breed standards all currently live in React state in `App`, `AdminView`, and `SettingsView` — all of it moves to the database.

---

## Phase 3 — Offline-first sync

Mandatory if Phase 0 confirms unreliable barn wifi; otherwise still recommended before a real pilot, since the current "no signal" toggle is a demo simulation, not real offline storage — a genuine wifi drop today would just lose the data.

- Local write queue in IndexedDB (not localStorage — better suited to a structured, growing queue) for entries logged while offline.
- Client-generated UUID on every entry at creation time, so a retried sync can't create duplicates.
- Real connectivity detection tied to actually reaching Supabase, not just `navigator.onLine`, which can lie on weak wifi or captive portals.
- Conflict handling should be simple here: this is append-only logging, not collaborative editing of the same record, so the main risk is duplicate inserts on retry — solved by the UUID above.

---

## Phase 4 — Security hardening

- **Write an actual RLS test matrix**: log in as each role, confirm what it can and can't read or write. Writing RLS policies and hoping they're correct isn't a security guarantee — testing them is.
- **Session expiry** on shared tablets, so a worker walking away mid-shift doesn't leave the next person logged in as them.
- **Confirm the anon key exposure is safe** — it is, by Supabase's design, but only if RLS is airtight. This ties directly back to the test matrix above.
- **Audit that the `service_role` key never ships to any client bundle.** This one is a hard rule, not a nice-to-have.
- **Basic dependency audit** before the pilot goes live.

---

## Phase 5 — Infra ownership & environment separation

- Complete the move of GitHub, Vercel, and Supabase to Versova-owned accounts (flagged in Phase 0 — do it early, not as cleanup after the pilot).
- Stand up separate **staging** and **production** Supabase environments. Even a two-week pilot shouldn't share a database with your own dev iteration.
- Upgrade Supabase to Pro tier before the pilot: daily backups, and the project won't pause itself from inactivity.

---

## Phase 6 — Pilot rollout

- Provision 1–2 real worker accounts and 1 manager account for the pilot barn.
- Get tablets into barn hands. This is the one item on this list that isn't code and has its own lead time — start procurement in parallel with Phase 1, not after Phase 5.
- Run the pilot for the defined window with close observation. The same instinct that led you to demo informally with 1–2 trusted managers first applies here too.
- Afterward, review the real logged data for anomalies — duplicate entries from sync retries, any RLS gap that let something through, latency complaints — before calling this ready for the full district.

---

## What this means for timeline

Phases 1 and 2 are the bulk of the real engineering effort — schema design, auth, RLS, and rewiring every component's data flow off local state. Phases 3 through 6 are individually smaller, but none of them are optional if the actual goal is an unsupervised test in a real barn rather than a supervised demo on your laptop. Hardware procurement (Phase 6) has its own lead time and should start now, in parallel, not after the software is ready.
