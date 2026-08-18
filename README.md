# FlockLog

Mortality, weight, and task tracking for poultry barns, built for Versova. Barn
workers log dead birds by cage location on a tablet; managers and district staff
see live rollups across farms.

Built in React with a Supabase (Postgres) backend.

---

## Quick start

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`). Open it in a browser.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

There is **no `.env` file to set up.** The Supabase URL and publishable key are
committed at the top of `src/App.jsx` — see [Security](#security) below for why
that is intentional.

---

## Signing in

Sign-in is name-then-PIN, designed for a shared tablet used with gloves on —
not email-and-password.

1. The app reads the `directory` table to list the people who can sign in.
2. You tap your name, then enter your PIN.
3. The app converts your name and farm into a hidden internal email
   (`austin@hawkeye.flocklog.local`) via `emailFor()`, then calls
   `supabase.auth.signInWithPassword()` with the PIN as the password.
4. On success it loads your row from `profiles` to get your role and farm.

So these are real Supabase auth accounts with real sessions — the synthetic
email is just a way to keep the tap-a-name-and-PIN interface on top of standard
Supabase auth. Accounts are created server-side by the `provision-account` Edge
Function, which must build the email with the same rule as `emailFor()`.

If the `directory` table comes back empty, the app shows a bootstrap screen for
creating the first account.

### Roles

| Role | Sees | Can edit |
| --- | --- | --- |
| `worker` | Their own barn | Log and edit entries in their barn |
| `manager` | All farms (read) | Their own farm |
| `district` | All farms | Everything, including creating farms |

Role is read from `profiles.role` after sign-in and drives which screen you land
on: workers go straight to their barn, managers to their farm dashboard,
district to the all-farms view.

---

## How the code is organized

```
index.html         Vite host page — fonts, dark background, #root
vite.config.js     Vite + React plugin (no custom config)
src/main.jsx       React entry point, mounts <App/>
src/App.jsx        The entire application (~3000 lines)
```

`src/App.jsx` is one large file rather than a component tree across many files.
That is a known tradeoff carried over from how the app was originally
prototyped, not a deliberate architecture. Its major sections, in order:

| Lines (approx.) | Section |
| --- | --- |
| 1–110 | Supabase client, `emailFor()`, farm/barn layout config, translation strings |
| 110–210 | Helpers — population math, flag thresholds, barn config lookups |
| 208–500 | Shared UI primitives — `Btn`, `TrendBars`, `WeightChart`, CSV export/modals |
| 495–655 | `WeightModal` — weight entry |
| 657–1610 | `App` — auth, all Supabase reads/writes, top-level screen routing |
| 1618–1830 | `RegionView` — the all-farms rollup, plus `AddFarmPanel` |
| 1830–2660 | `AdminView` — the barn-level logging screen, the core worker workflow |
| 2662–3025 | `SettingsView` — barn config, accounts, breed standards |

**Farm layout is data, not code.** Each farm's barns, floors, rows, and tiers
are defined in the `FARMS` object near the top of `App.jsx`, with overrides
stored in the database. Adding a farm should not require new components.

**The app is bilingual (English/Spanish).** Strings go through `T("english",
"español")`. `LANG` is a module-level variable near line 80. Note that it is a
plain `let`, not React state, so language changes do not automatically re-render
— worth revisiting.

---

## The backend

One Supabase project. `App.jsx` reads and writes these 13 tables directly from
the browser:

| Table | Holds |
| --- | --- |
| `directory` | Names shown on the sign-in screen |
| `profiles` | Account identity — role, farm |
| `farms` | Farm records |
| `barns` | Barn config overrides |
| `flocks` | The active flock per barn |
| `flock_archives` | Snapshots of finished flocks |
| `mortality_entries` | Dead-bird logs — the core table |
| `weight_entries` | Sample bird weights |
| `population_tiers`, `population_rows` | Bird counts by cage location |
| `breed_standards` | Expected weight by week, for comparison |
| `flag_settings` | Per-farm alert thresholds |
| `tasks` | Task list |

One Edge Function, `provision-account`, creates accounts server-side.

Data flows straight from React handlers into `supabase.from(...)` calls — there
is no API layer, service module, or data-access abstraction in between.

---

## Security

**The Supabase key in `src/App.jsx` is a publishable key and is meant to ship in
browser code.** It is not a leaked secret. It can only do what the database's
Row-Level Security (RLS) policies permit.

That makes RLS the *entire* security model. Before this handles real employee or
production data, someone needs to confirm:

- RLS is enabled on all 13 tables, and policies actually enforce the
  worker/manager/district boundaries described above. The role checks in
  `App.jsx` are client-side only — they control what the UI draws, and anyone
  with browser dev tools open can bypass them.
- `created_at` and `user_id` are stamped server-side by triggers, not accepted
  from the client payload.
- The `service_role` key has never been committed or shipped to a client bundle.

`flocklog-deployment-roadmap.md` (Phase 4) covers this in more detail, including
the suggestion to write an explicit RLS test matrix rather than assuming the
policies are correct.

---

## Status and what's next

`flocklog-deployment-roadmap.md` is the plan for getting from here to a real
barn pilot. **Note that it was written before the Supabase backend existed** and
still describes the app as fully client-side with seeded demo data. Phases 1 and
2 (schema, auth, RLS, rewiring to real data) have since been substantially
built. Phases 0 and 3–6 — infra ownership, offline sync, security testing,
environment separation, and the pilot itself — are still open.

The largest known gap for real barn use is **offline support** (Phase 3). The
"no signal" toggle in the UI today is a demo simulation; a genuine wifi drop
would lose the entry. Barns with unreliable wifi need a real IndexedDB write
queue with client-generated UUIDs before any unsupervised pilot.
