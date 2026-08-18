/* ================= DEMO BACKEND =================
   A drop-in stand-in for the Supabase client, backed entirely by in-memory
   fake data. Nothing here touches the network. It exists so the app can be
   shown to people without handing out credentials to the real database.

   The point is that App.jsx does not know the difference: this exports an
   object with the same shape the app already calls — .from(table) returning a
   chainable query builder, .auth, and .functions.invoke — so the demo runs the
   real UI and the real logic, only against invented rows.

   Everything is generated at load time rather than checked in as a big JSON
   blob, which keeps the bundle small and makes the dates always look current.

   To regenerate different-looking data, change SEED. */

const SEED = 20260818;
const DAY = 86400000;

/* Deterministic PRNG so every visitor sees the same demo, and so a reload
   doesn't reshuffle the charts under someone mid-sentence. */
function makeRng(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rand = makeRng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

let idCounter = 0;
const uid = (p) => `${p}-${(++idCounter).toString(36).padStart(5, "0")}`;

/* Same slug rule App.jsx's emailFor() uses, duplicated here so the demo's
   sign-in matches the real one exactly. */
function emailFor(name, farmId) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}@${farmId || "district"}.flocklog.local`;
}

/* ---- Farm shapes. Mirrors the FARMS constant in App.jsx. ---- */
const SHAPE = {
  hawkeye: {
    name: "Hawkeye Pride", state: "IA",
    barns: ["1A","1B","2A","2B","3A","3B","4A","4B","5A","5B","6A","6B","7A","7B"],
    floors: ["Top","Bottom"], rows: 10, tiers: 6, tierPop: 7500,
  },
  trillium: {
    name: "Trillium", state: "OH",
    barns: ["1","2","3","4"],
    floors: ["Main"], rows: 8, tiers: 4, tierPop: 9000,
  },
  centrum: {
    name: "Centrum Valley", state: "IA",
    barns: ["A1","A2","B1","B2","C1","C2"],
    floors: ["Top","Bottom"], rows: 12, tiers: 6, tierPop: 6000,
  },
};
const SECTIONS = ["Front", "Middle", "Back"];
const CAUSES = ["prolapse", "caught", "cull", "unknown"];
const BREEDS = ["Hy-Line W-36", "Lohmann LSL", "Bovans White"];

/* ---- People. Invented names — no real Versova staff. ---- */
const PEOPLE = [
  { name: "Dana Whitfield", role: "district", farm_id: null },
  { name: "Marcos Ruiz",    role: "manager",  farm_id: "hawkeye" },
  { name: "Elena Torres",   role: "worker",   farm_id: "hawkeye" },
  { name: "Sam Becker",     role: "worker",   farm_id: "hawkeye" },
  { name: "Rosa Delgado",   role: "worker",   farm_id: "hawkeye" },
  { name: "Priya Nair",     role: "manager",  farm_id: "trillium" },
  { name: "Jorge Medina",   role: "worker",   farm_id: "trillium" },
  { name: "Tom Lindgren",   role: "manager",  farm_id: "centrum" },
  { name: "Ana Flores",     role: "worker",   farm_id: "centrum" },
];

/* ================= SEED ================= */
function buildTables() {
  const now = Date.now();
  const profiles = PEOPLE.map((p) => ({
    id: uid("usr"), name: p.name, role: p.role, farm_id: p.farm_id,
    active: true, email: emailFor(p.name, p.farm_id),
  }));
  const workersAt = (farm) =>
    profiles.filter((p) => p.farm_id === farm && p.role !== "district");

  const farms = Object.keys(SHAPE).map((id) => ({
    id, name: SHAPE[id].name, state: SHAPE[id].state,
    default_rows: SHAPE[id].rows, default_tiers: SHAPE[id].tiers,
    default_floor_count: SHAPE[id].floors.length,
    default_tier_pop: SHAPE[id].tierPop,
  }));

  const barns = [];
  Object.keys(SHAPE).forEach((f) => SHAPE[f].barns.forEach((code) => {
    barns.push({ farm_id: f, code, rows: SHAPE[f].rows, tiers: SHAPE[f].tiers,
      floor_count: SHAPE[f].floors.length });
  }));

  /* Flocks: each barn placed somewhere in the last 4–14 months, so the
     region view shows a realistic spread of ages rather than one cohort. */
  const flocks = [];
  Object.keys(SHAPE).forEach((f) => SHAPE[f].barns.forEach((code) => {
    const ageWk = intBetween(19, 78);
    const start = SHAPE[f].tierPop * SHAPE[f].tiers * SHAPE[f].floors.length;
    flocks.push({
      farm_id: f, barn: code,
      placed_ts: new Date(now - ageWk * 7 * DAY).toISOString(),
      age_wk: ageWk, breed: pick(BREEDS),
      start_pop: Math.round(start * between(0.97, 1.0)),
    });
  }));
  const flockOf = (f, code) =>
    flocks.find((x) => x.farm_id === f && x.barn === code) || {};

  /* Population by tier and by row. Tier counts drift a little around the
     farm default; row counts are the tier total split across rows. */
  const population_tiers = [];
  const population_rows = [];
  Object.keys(SHAPE).forEach((f) => {
    const s = SHAPE[f];
    s.barns.forEach((code) => s.floors.forEach((floor) => {
      let floorTotal = 0;
      for (let t = 1; t <= s.tiers; t++) {
        const pop = Math.round(s.tierPop * between(0.93, 1.02));
        floorTotal += pop;
        population_tiers.push({ farm_id: f, barn: code, floor, tier: t, population: pop });
      }
      const per = Math.round(floorTotal / s.rows);
      for (let r = 1; r <= s.rows; r++) {
        population_rows.push({ farm_id: f, barn: code, floor,
          row_num: r, population: Math.round(per * between(0.95, 1.05)) });
      }
    }));
  });

  /* Mortality: ~60 days of daily walks per barn. A couple of barns get a
     deliberate spike so the flag/alert logic has something to catch. */
  const DAYS = 60;
  const HOT = { "hawkeye|3B": true, "centrum|B1": true };
  const mortality_entries = [];
  Object.keys(SHAPE).forEach((f) => {
    const s = SHAPE[f];
    const crew = workersAt(f);
    s.barns.forEach((code) => {
      const hot = HOT[`${f}|${code}`];
      const flk = flockOf(f, code);
      for (let d = DAYS; d >= 0; d--) {
        // Older flocks die a little more; hot barns spike in the last 10 days.
        const ageFactor = 1 + Math.max(0, (flk.age_wk - 55)) / 60;
        let n = Math.round(between(0, 3.2) * ageFactor);
        if (hot && d < 10) n += intBetween(4, 11);
        for (let i = 0; i < n; i++) {
          const who = crew.length ? pick(crew) : profiles[0];
          const floor = pick(s.floors);
          // Walks happen in the morning; scatter within a plausible window.
          const ts = now - d * DAY
            - (12 * 3600000) + Math.floor(between(0, 4 * 3600000));
          mortality_entries.push({
            id: uid("mrt"), ts: new Date(ts).toISOString(),
            user_id: who.id, farm_id: f, barn: code, floor,
            row: intBetween(1, s.rows), section: pick(SECTIONS),
            tier: intBetween(1, s.tiers), cause: pick(CAUSES),
          });
        }
      }
    });
  });

  /* Weights: one case sample and one body sample per barn per week. */
  const weight_entries = [];
  Object.keys(SHAPE).forEach((f) => {
    const crew = workersAt(f);
    SHAPE[f].barns.forEach((code) => {
      const flk = flockOf(f, code);
      for (let w = 8; w >= 0; w--) {
        const who = crew.length ? pick(crew) : profiles[0];
        const ts = new Date(now - w * 7 * DAY).toISOString();
        const wk = flk.age_wk - w;
        // Body weight climbs early then plateaus; case weight tracks it.
        const body = round(Math.min(4.05, 2.6 + wk * 0.02) + between(-0.08, 0.08), 2);
        weight_entries.push({ id: uid("wgt"), ts, user_id: who.id, farm_id: f,
          barn: code, type: "body", case_lbs: null, body_lbs: body,
          uniformity: round(between(82, 93), 0) });
        weight_entries.push({ id: uid("wgt"), ts, user_id: who.id, farm_id: f,
          barn: code, type: "case", case_lbs: round(between(46.5, 51.5), 1),
          body_lbs: null, uniformity: null });
      }
    });
  });

  /* Breed standards, weeks 17–90, per farm. */
  const breed_standards = [];
  Object.keys(SHAPE).forEach((f) => {
    for (let wk = 17; wk <= 90; wk++) {
      breed_standards.push({ farm_id: f, wk,
        mort: round(0.04 + wk * 0.0012, 3),
        case_lbs: round(47 + Math.min(wk, 45) * 0.06, 1),
        body_lbs: round(Math.min(4.0, 2.55 + wk * 0.021), 2),
        unif: 90 });
    }
  });

  const flag_settings = Object.keys(SHAPE).map((f) => ({
    farm_id: f, mode: "auto", threshold: 5,
  }));

  /* Tasks: a believable mix of open and done, some assigned, some not. */
  const TASK_TEXT = [
    "Check feeder line on row 4 — birds crowding the front",
    "Replace burnt bulb, Top floor back section",
    "Water pressure low in tier 5, needs a look",
    "Recount tier 3 population, numbers look off",
    "Egg belt slipping in the morning run",
    "Clear manure buildup under row 8",
    "Fan 2 rattling — get maintenance out",
    "Restock gloves and boot covers at entry",
    "Weekly weight sample due",
    "Check the cage door latch, row 6 middle",
  ];
  const tasks = [];
  TASK_TEXT.forEach((text, i) => {
    const f = pick(Object.keys(SHAPE));
    const s = SHAPE[f];
    const crew = workersAt(f);
    const done = i % 3 === 0;
    const who = crew.length ? pick(crew) : profiles[0];
    const created = now - intBetween(1, 20) * DAY;
    tasks.push({
      id: uid("tsk"), farm_id: f, barn: pick(s.barns), floor: pick(s.floors),
      text, assigned_to: rand() > 0.35 ? who.id : null,
      due: new Date(now + intBetween(-2, 9) * DAY).toISOString().slice(0, 10),
      status: done ? "done" : "open",
      done_by: done ? who.id : null,
      done_ts: done ? new Date(created + DAY).toISOString() : null,
      created_at: new Date(created).toISOString(),
      created_by: who.id,
    });
  });

  /* A couple of finished flocks so the "Past flocks" list isn't empty. */
  const flock_archives = [];
  [["hawkeye", "1A"], ["hawkeye", "2B"], ["trillium", "1"]].forEach(([f, code]) => {
    const placed = now - intBetween(130, 190) * 7 * DAY;
    const ended = placed + intBetween(70, 95) * 7 * DAY;
    const start = SHAPE[f].tierPop * SHAPE[f].tiers * SHAPE[f].floors.length;
    flock_archives.push({
      id: uid("arc"), farm_id: f, barn: code, breed: pick(BREEDS),
      placed_ts: new Date(placed).toISOString(),
      ended_ts: new Date(ended).toISOString(),
      start_pop: start, total_deaths: intBetween(2200, 4800),
      mortality: [], weights: [],
    });
  });

  const directory = profiles.map((p) => ({
    id: p.id, name: p.name, role: p.role, farm_id: p.farm_id,
  }));

  return { profiles, directory, farms, barns, flocks, flock_archives,
    mortality_entries, weight_entries, population_tiers, population_rows,
    breed_standards, flag_settings, tasks };
}

/* ================= FAKE QUERY BUILDER =================
   Supports exactly the subset of PostgREST that App.jsx actually uses:
   select / insert / update / upsert / delete, .eq() filters, .order(),
   .single(), and the one embedded relation (profiles(name)). */
function makeClient() {
  const db = buildTables();
  const ok = (data) => ({ data, error: null });
  const fail = (message) => ({ data: null, error: { message } });

  const matches = (row, filters) =>
    filters.every(([col, val]) => row[col] === val);

  class Query {
    constructor(table) {
      this.table = table;
      this.op = "select";
      this.cols = "*";
      this.filters = [];
      this.orderBy = null;
      this.isSingle = false;
      this.wantsReturn = false;
      this.payload = null;
      this.opts = null;
    }
    select(cols) {
      // .select() after insert/upsert means "return the rows", not a new query.
      if (this.op === "insert" || this.op === "upsert") this.wantsReturn = true;
      else this.op = "select";
      this.cols = cols || "*";
      return this;
    }
    eq(col, val) { this.filters.push([col, val]); return this; }
    order(col, opts) {
      this.orderBy = [col, opts && opts.ascending === false ? -1 : 1];
      return this;
    }
    single() { this.isSingle = true; return this; }
    insert(rows) { this.op = "insert"; this.payload = rows; return this; }
    upsert(rows, opts) { this.op = "upsert"; this.payload = rows; this.opts = opts; return this; }
    update(patch) { this.op = "update"; this.payload = patch; return this; }
    delete() { this.op = "delete"; return this; }

    run() {
      const rows = db[this.table];
      if (!rows) return fail(`demo: unknown table "${this.table}"`);

      if (this.op === "select") {
        let out = rows.filter((r) => matches(r, this.filters));
        if (this.orderBy) {
          const [col, dir] = this.orderBy;
          out = out.slice().sort((a, b) =>
            a[col] === b[col] ? 0 : (a[col] < b[col] ? -1 : 1) * dir);
        }
        // The app asks for "*, profiles(name)" on entries and weights.
        if (this.cols.includes("profiles(")) {
          out = out.map((r) => {
            const p = db.profiles.find((x) => x.id === r.user_id);
            return { ...r, profiles: p ? { name: p.name } : null };
          });
        }
        if (this.isSingle) return out.length ? ok(out[0]) : fail("no rows");
        return ok(out);
      }

      if (this.op === "insert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const added = list.map((r) => ({ id: r.id || uid("row"), ...r }));
        rows.push(...added);
        if (this.isSingle) return ok(added[0]);
        return ok(this.wantsReturn ? added : null);
      }

      if (this.op === "upsert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const keys = (this.opts && this.opts.onConflict
          ? this.opts.onConflict : "id").split(",").map((k) => k.trim());
        const added = [];
        list.forEach((r) => {
          const i = rows.findIndex((x) => keys.every((k) => x[k] === r[k]));
          if (i === -1) { const row = { id: r.id || uid("row"), ...r }; rows.push(row); added.push(row); }
          else if (!(this.opts && this.opts.ignoreDuplicates)) {
            rows[i] = { ...rows[i], ...r }; added.push(rows[i]);
          }
        });
        if (this.isSingle) return ok(added[0] || null);
        return ok(this.wantsReturn ? added : null);
      }

      if (this.op === "update") {
        rows.forEach((r, i) => {
          if (matches(r, this.filters)) rows[i] = { ...r, ...this.payload };
        });
        return ok(null);
      }

      if (this.op === "delete") {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (matches(rows[i], this.filters)) rows.splice(i, 1);
        }
        return ok(null);
      }
      return fail("demo: unsupported operation");
    }

    // Thenable: `await supabase.from(...)...` and `.then(...)` both work.
    then(res, rej) {
      return new Promise((resolve) => setTimeout(resolve, 60))
        .then(() => this.run()).then(res, rej);
    }
  }

  return {
    __demo: true,
    from: (table) => new Query(table),
    auth: {
      // Any PIN signs you in. This is a demo — there is nothing to protect.
      async signInWithPassword({ email }) {
        const p = db.profiles.find((x) => x.email === email && x.active);
        if (!p) return fail("Invalid login credentials");
        return { data: { user: { id: p.id } }, error: null };
      },
      async signOut() { return { error: null }; },
    },
    functions: {
      async invoke(name, { body } = {}) {
        if (name === "provision-account") {
          const clean = (body.name || "").trim();
          if (!clean) return fail("Name is required");
          const email = emailFor(clean, body.farm_id);
          if (db.profiles.some((p) => p.email === email)) {
            return fail("That name is already taken at this farm");
          }
          const row = { id: uid("usr"), name: clean, role: body.role,
            farm_id: body.farm_id || null, active: true, email };
          db.profiles.push(row);
          db.directory.push({ id: row.id, name: row.name, role: row.role,
            farm_id: row.farm_id });
          return ok({ ok: true });
        }
        if (name === "manage-account") {
          const p = db.profiles.find((x) => x.id === body.user_id);
          if (!p) return fail("Account not found");
          if (body.action === "deactivate") {
            p.active = false;
            const i = db.directory.findIndex((d) => d.id === p.id);
            if (i > -1) db.directory.splice(i, 1);
          } else if (body.action === "reactivate") {
            p.active = true;
            db.directory.push({ id: p.id, name: p.name, role: p.role, farm_id: p.farm_id });
          } else if (body.action === "role") {
            p.role = body.role;
            const d = db.directory.find((x) => x.id === p.id);
            if (d) d.role = body.role;
          }
          return ok({ ok: true });
        }
        return fail(`demo: unknown function "${name}"`);
      },
    },
  };
}

/* Demo mode is on when the build sets VITE_DEMO=1, or when anyone adds ?demo
   to the URL. The second form lets you show the fake data from a normal build
   without touching the real one. */
export const DEMO =
  (import.meta.env && import.meta.env.VITE_DEMO === "1") ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("demo"));

export const createDemoClient = makeClient;
