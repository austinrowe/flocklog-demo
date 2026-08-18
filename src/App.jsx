import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Real backend. Anon/publishable key is meant to be public — it can only do
// what the database's Row-Level Security policies allow it to do.
const SUPABASE_URL = "https://xbolgiibpcabwfzrkvbn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nSI4lWciatWSBodGgMSLYw_Z6Y2vrye";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Same slug rule the server (provision-account Edge Function) uses to build
// each account's real, hidden login email from its display name + farm.
function emailFor(name, farmId) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}@${farmId || "district"}.flocklog.local`;
}
/* ================= FARM CONFIGURATION =================
   Layout is data, not code. Each farm defines its own barns,
   floors, rows, tiers, and default placement per tier.
   Deploying at a new farm = adding one entry here (later: one DB row). */
const FARMS = {
  hawkeye: {
    name: "Hawkeye Pride", state: "IA",
    barns: ["1A","1B","2A","2B","3A","3B","4A","4B","5A","5B","6A","6B","7A","7B"],
    floors: ["Top","Bottom"], rows: 10, tiers: 6, defaultTierPop: 7500,
  },
  trillium: {
    name: "Trillium", state: "OH",
    barns: ["1","2","3","4"],
    floors: ["Main"], rows: 8, tiers: 4, defaultTierPop: 9000,
  },
  centrum: {
    name: "Centrum Valley", state: "IA",
    barns: ["A1","A2","B1","B2","C1","C2"],
    floors: ["Top","Bottom"], rows: 12, tiers: 6, defaultTierPop: 6000,
  },
};
const SECTIONS = ["Front","Middle","Back"];
const CAUSES = [
  { id: "prolapse", label: "Prolapse", es: "Prolapso" },
  { id: "caught",   label: "Cage caught", es: "Atrapada en jaula" },
  { id: "cull",     label: "Cull", es: "Descarte" },
  { id: "unknown",  label: "Unknown", es: "Desconocida" },
];
const SECTION_ES = { Front: "Frente", Middle: "Medio", Back: "Atrás" };
const FLOOR_ES = { Top: "Arriba", Middle: "Medio", Bottom: "Abajo", Main: "Principal" };
const STR = {
  selectBarn: ["select barn", "elige el galpón"],
  floor: ["Floor", "Piso"],
  startWalk: ["Start walk →", "Empezar recorrido →"],
  mapHint: ["Barn map — tap the spot (row + section in one tap) · Front is top of screen",
    "Mapa del galpón — toca el lugar (fila + sección en un toque) · El frente está arriba"],
  swipeHint: [" · swipe sideways for more rows", " · desliza de lado para más filas"],
  tierHint: ["Tier — top of ladder = top of screen",
    "Nivel — lo alto de la escalera = arriba en pantalla"],
  loggingAt: ["Logging at", "Registrando en"],
  pickSpot: ["Pick a spot on the map", "Toca un lugar en el mapa"],
  row: ["Row", "Fila"],
  tier: ["Tier", "Nivel"],
  birdsWalk: ["birds this walk (unsaved)", "aves en este recorrido (sin guardar)"],
  undoLast: ["Undo last", "Deshacer última"],
  finishSave: ["Finish barn · save", "Terminar galpón · guardar"],
  saveQ: ["Save barn", "¿Guardar galpón"],
  willCommit: ["birds will be committed under", "aves se guardarán a nombre de"],
  keepLogging: ["Keep logging", "Seguir registrando"],
  save: ["Save", "Guardar"],
  signOut: ["Sign out", "Salir"],
  task: ["Task", "Tarea"],
  markDone: ["Mark done", "Hecho"],
  spotCleared: ["Spot cleared — tap where you are now",
    "Lugar borrado — toca donde estás ahora"],
  pinFor: ["PIN for", "PIN de"],
  back: ["Back", "Atrás"],
  farmManager: ["Farm manager", "Gerente de granja"],
  signal: ["signal", "señal"],
  noSignal: ["no signal", "sin señal"],
  delQ: ["Delete this bird?", "¿Borrar esta ave?"],
  cancel: ["Cancel", "Cancelar"],
  del: ["Delete", "Borrar"],
};
let LANG = "en";
const T = (en, es) => (LANG === "es" ? es : en);
const causeT = (c) => (LANG === "es" ? c.es : c.label);
const secT = (s, short) => LANG === "es" ? SECTION_ES[s] || s : (short && s === "Middle" ? "Mid" : s);
const floorT = (f) => (LANG === "es" ? FLOOR_ES[f] || f : f);
const FLAG_THRESHOLD = 5;
/* ================= THEME =================
   Two palettes; C is mutated on toggle and every component reads C at render. */
const THEMES = {
  dark: {
    bg: "#15181C", panel: "#1E2328", panel2: "#232A30", line: "#31383F",
    amber: "#FFB020", amberDim: "#7A5510", text: "#F2F0EA", mut: "#97A0A8",
    red: "#FF5A48", green: "#4CC38A", dis: "#5A636B", faint: "#4A525A",
  },
  light: {
    bg: "#F2F0EA", panel: "#FFFFFF", panel2: "#E7E4DA", line: "#CFCBBE",
    amber: "#E89B00", amberDim: "#C98800", text: "#1F1E1A", mut: "#63676E",
    red: "#D93B2B", green: "#1E8A5B", dis: "#A5A196", faint: "#C2BEB1",
  },
};
const C = { ...THEMES.dark };
const font = {
  disp: "'Barlow Condensed', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  body: "-apple-system, 'Segoe UI', Roboto, sans-serif",
};
const STD_DEFAULT = [
  { wk: 18, mort: 0.10, caseW: 43.5, body: 3.10, unif: 85 },
  { wk: 25, mort: 0.10, caseW: 45.5, body: 3.30, unif: 85 },
  { wk: 35, mort: 0.12, caseW: 47.0, body: 3.40, unif: 84 },
  { wk: 50, mort: 0.15, caseW: 48.5, body: 3.50, unif: 82 },
  { wk: 65, mort: 0.20, caseW: 49.5, body: 3.60, unif: 80 },
  { wk: 80, mort: 0.25, caseW: 50.0, body: 3.65, unif: 78 },
];
function stdAt(stds, wk) {
  const num = (x) => parseFloat(x) || 0;
  const s = [...stds].map((r) => ({ wk: num(r.wk), mort: num(r.mort), caseW: num(r.caseW),
    body: num(r.body), unif: num(r.unif) })).sort((a, b) => a.wk - b.wk);
  if (wk <= s[0].wk) return s[0];
  if (wk >= s[s.length - 1].wk) return s[s.length - 1];
  for (let i = 0; i < s.length - 1; i++) {
    if (wk >= s[i].wk && wk <= s[i + 1].wk) {
      const t = (wk - s[i].wk) / (s[i + 1].wk - s[i].wk);
      const lerp = (a, b) => a + (b - a) * t;
      return { wk, mort: lerp(s[i].mort, s[i + 1].mort), caseW: lerp(s[i].caseW, s[i + 1].caseW),
        body: lerp(s[i].body, s[i + 1].body), unif: lerp(s[i].unif, s[i + 1].unif) };
    }
  }
  return s[0];
}
function seedWeather() {
  const conds = ["Sunny", "Cloudy", "Rain", "Storm", "Windy"];
  const m = {};
  Object.keys(FARMS).forEach((f, fi) => {
    const arr = [];
    for (let d = 30; d >= 0; d--) {
      const day = new Date(); day.setHours(0, 0, 0, 0);
      const ts = day.getTime() - d * 86400000;
      const base = 80 + 9 * Math.sin((d + fi * 3) / 4.5) + (Math.random() * 8 - 4);
      let hi = Math.round(base), cond = conds[Math.floor(Math.random() * conds.length)];
      if (d === 2 || d === 12) { hi = 96 + fi; cond = "Heat wave"; } // planted heat events
      arr.push({ ts, hi, lo: hi - 18 - Math.floor(Math.random() * 5), cond });
    }
    m[f] = arr;
  });
  return m;
}
function wxOn(wx, ts) {
  if (!wx) return null;
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  return wx.find((w) => w.ts === d.getTime()) || null;
}
function smallBtn(color) {
  return { background: color || C.panel2, color: color ? "#15181C" : C.text,
    border: `1px solid ${color || C.line}`, borderRadius: 8, padding: "8px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer" };
}
/* ================= HELPERS ================= */
function farmPop(farmId, popByTier, popByRow, overrides, barnsMap) {
  const cfg = FARMS[farmId]; let sum = 0;
  const barns = (barnsMap && barnsMap[farmId]) || cfg.barns;
  barns.forEach((b) => {
    const bcf = barnCfg(farmId, b, overrides);
    bcf.floors.forEach((f) => {
      const key = `${farmId}-${b}-${f}`;
      const arr = popByTier[key];
      const tierSum = arr ? arr.reduce((a, x) => a + x, 0) : bcf.tiers * cfg.defaultTierPop;
      const rArr = (popByRow || {})[key];
      if (rArr) {
        const def = Math.round(tierSum / bcf.rows);
        let s = 0;
        for (let i = 0; i < bcf.rows; i++) s += rArr[i] != null ? rArr[i] : def;
        sum += s;
      } else sum += tierSum;
    });
  });
  return sum;
}
function barnCfg(farmId, barn, overrides) {
  const base = FARMS[farmId];
  const o = (overrides || {})[`${farmId}-${barn}`] || {};
  return { rows: o.rows || base.rows, tiers: o.tiers || base.tiers,
    floors: o.floors || base.floors };
}
function floorLabels(n) {
  return n <= 1 ? ["Main"] : n === 2 ? ["Top", "Bottom"] : ["Top", "Middle", "Bottom"];
}
function flagLimit(mode, th, expected) {
  if (mode !== "auto") return th;
  return Math.max(3, Math.ceil(expected + 2.5 * Math.sqrt(Math.max(expected, 0.5))));
}
function farmFlags(farmId, saved, overrides, barnsMap, threshold, mode, sinceTs) {
  const cfg = FARMS[farmId];
  const th = threshold || FLAG_THRESHOLD;
  const data = saved.filter((e) => e.farm === farmId && (!sinceTs || e.ts > sinceTs));
  let flags = 0;
  (((barnsMap && barnsMap[farmId]) || cfg.barns)).forEach((b) => {
    const bc = barnCfg(farmId, b, overrides);
    bc.floors.forEach((f) => {
      const dd = data.filter((e) => e.barn === b && e.floor === f);
      const lim = flagLimit(mode || "auto", th, dd.length / (bc.rows * SECTIONS.length));
      for (let r = 1; r <= bc.rows; r++) for (const s of SECTIONS)
        if (dd.filter((e) => e.row === r && e.section === s).length >= lim) flags++;
    });
  });
  return flags;
}
/* ================= SHARED UI ================= */
function Btn({ label, sub, on, active, disabled, tall, wide, color }) {
  return (
    <button onClick={on} disabled={disabled} style={{
      fontFamily: font.disp, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.06em", fontSize: tall ? 22 : 20, lineHeight: 1.1,
      color: disabled ? C.dis : active ? "#15181C" : C.text,
      background: active ? (color || C.amber) : C.panel2,
      border: `1px solid ${active ? (color || C.amber) : C.line}`,
      borderRadius: 10, padding: tall ? "18px 10px" : "16px 10px",
      minHeight: 64, width: wide ? "100%" : undefined, cursor: disabled ? "default" : "pointer",
      transition: "background 80ms, transform 60ms",
    }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
      {label}
      {sub && <div style={{ fontFamily: font.body, fontWeight: 400, fontSize: 12,
        textTransform: "none", letterSpacing: 0, color: active ? "#3A2A00" : C.mut, marginTop: 4 }}>{sub}</div>}
    </button>
  );
}
function Eyebrow({ children }) {
  return <div style={{ fontFamily: font.disp, textTransform: "uppercase",
    letterSpacing: "0.18em", fontSize: 13, color: C.mut, margin: "0 0 10px 2px" }}>{children}</div>;
}
const inputStyle = {
  background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
  color: C.text, fontSize: 14, padding: "12px 12px",
};
function useNarrow() {
  const [w, setW] = useState(typeof window === "undefined" ? 1024 : window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w < 640;
}
const RANGES = [[1, "24 h"], [7, "7 d"], [30, "30 d"]];
function RangeToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {RANGES.map(([d, lbl]) => (
        <button key={d} onClick={() => onChange(d)} style={{
          fontFamily: font.mono, fontSize: 12, padding: "7px 10px", borderRadius: 8,
          background: value === d ? C.amber : C.panel2, color: value === d ? "#15181C" : C.mut,
          border: `1px solid ${value === d ? C.amber : C.line}`, cursor: "pointer" }}>{lbl}</button>
      ))}
    </div>
  );
}
function TrendBars({ data, days, wx }) {
  const [hov, setHov] = useState(null);
  const now = Date.now();
  const hourly = days === 1;
  const n = hourly ? 24 : days;
  const step = hourly ? 3600000 : 86400000;
  const buckets = Array.from({ length: n }, (_, i) => {
    const end = now - (n - 1 - i) * step;
    const list = data.filter((e) => e.ts > end - step && e.ts <= end);
    return { end, n: list.length, list };
  });
  const mx = Math.max(1, ...buckets.map((b) => b.n));
  const lbl = (b) => {
    const d = new Date(b.end);
    const date = hourly
      ? `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.getHours()}:00`
      : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const w = wxOn(wx, b.end);
    return `${date} — ${b.n} ${b.n === 1 ? T("bird", "ave") : T("birds", "aves")}${w ? ` · ${w.hi}°F ${w.cond}` : ""}`;
  };
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHov(null)}>
      {hov != null && (
        <div style={{ position: "absolute", bottom: "100%", marginBottom: 6,
          left: `${((hov + 0.5) / n) * 100}%`,
          transform: `translateX(${hov < n * 0.2 ? "0" : hov > n * 0.8 ? "-100%" : "-50%"})`,
          background: C.panel2, border: `1px solid ${C.amber}`, color: C.text,
          fontFamily: font.mono, fontSize: 12, padding: "5px 10px", borderRadius: 6,
          whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5 }}>
          {lbl(buckets[hov])}
          {buckets[hov].n > 0 && (
            <div style={{ color: C.mut, fontSize: 10, marginTop: 2 }}>
              {CAUSES.map((c) => {
                const k = buckets[hov].list.filter((e) => e.cause === c.id).length;
                return k ? `${causeT(c)} ${k}` : null;
              }).filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46 }}>
        {buckets.map((b, i) => (
          <div key={i} onMouseEnter={() => setHov(i)} onTouchStart={() => setHov(i)}
            style={{ flex: 1, height: 46, display: "flex", alignItems: "flex-end",
              cursor: "pointer" }}>
            <div style={{ width: "100%", height: `${Math.max(5, (b.n / mx) * 100)}%`,
              background: hov === i ? C.text : b.n ? C.amber : C.panel2, borderRadius: 2,
              opacity: b.n ? 0.45 + 0.55 * (b.n / mx) : 1 }} />
          </div>
        ))}
      </div>
      {wx && !hourly && (
        <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
          {buckets.map((b, i) => {
            const w = wxOn(wx, b.end);
            return <div key={i} onMouseEnter={() => setHov(i)}
              style={{ flex: 1, height: 5, borderRadius: 2,
                background: !w ? "transparent"
                  : w.hi >= 95 ? C.red : w.hi >= 88 ? C.amber : C.panel2 }} />;
          })}
        </div>
      )}
    </div>
  );
}
function WeightChart({ title, points, unit, decimals = 1, std = null }) {
  const [hov, setHov] = useState(null);
  if (!points.length) return (
    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.dis }}>{T("No entries yet.", "Aún no hay registros.")}</div>
    </div>
  );
  const vs = std != null ? [...points.map((p) => p.v), std] : points.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1;
  const min = lo - pad, max = hi + pad;
  const last = points[points.length - 1];
  return (
    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6,
        alignItems: "baseline" }}>
        <span style={{ fontSize: 12, color: C.mut }}>{title}</span>
        <span style={{ fontFamily: font.mono, fontSize: 13,
          color: std == null ? C.amber : last.v >= std * 0.98 ? C.green : C.red }}>
          {last.v.toFixed(decimals)}{unit}
          {std != null && <span style={{ color: C.mut, fontSize: 11 }}> / {T("std", "est.")} {(+std).toFixed(decimals)}</span>}
        </span>
      </div>
      <div style={{ position: "relative" }} onMouseLeave={() => setHov(null)}>
        {hov != null && (
          <div style={{ position: "absolute", bottom: "100%", marginBottom: 4,
            left: `${((hov + 0.5) / points.length) * 100}%`,
            transform: `translateX(${hov < points.length * 0.25 ? "0" : hov > points.length * 0.75 ? "-100%" : "-50%"})`,
            background: C.panel2, border: `1px solid ${C.amber}`, color: C.text,
            fontFamily: font.mono, fontSize: 11, padding: "4px 8px", borderRadius: 6,
            whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5 }}>
            {new Date(points[hov].ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {points[hov].v.toFixed(decimals)}{unit}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60,
          position: "relative" }}>
          {std != null && (
            <div style={{ position: "absolute", left: 0, right: 0,
              bottom: `${Math.max(0, Math.min(100, ((std - min) / (max - min)) * 100))}%`,
              borderTop: `1px dashed ${C.mut}`, zIndex: 2, pointerEvents: "none" }} />
          )}
          {points.map((p, i) => (
            <div key={i} onMouseEnter={() => setHov(i)} onTouchStart={() => setHov(i)}
              style={{ flex: 1, height: 60, display: "flex", alignItems: "flex-end",
                cursor: "pointer" }}>
              <div style={{ width: "100%",
                height: `${Math.max(6, ((p.v - min) / (max - min)) * 100)}%`,
                background: hov === i ? C.text : C.amber, borderRadius: 2,
                opacity: hov === i ? 1 : 0.75 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10,
          fontFamily: font.mono, color: C.dis, marginTop: 3 }}>
          <span>{min.toFixed(decimals)}</span><span>{max.toFixed(decimals)}</span>
        </div>
      </div>
    </div>
  );
}
function weightsCsv(rows, kind) {
  if (kind === "case") {
    const head = "date,farm,barn,case_lbs,logged_by";
    return [head, ...rows.filter((w) => w.type === "case").map((w) =>
      [new Date(w.ts).toLocaleDateString(), FARMS[w.farm].name, w.barn, w.caseW, w.by].join(","))].join("\n");
  }
  if (kind === "body") {
    const head = "date,farm,barn,body_lbs,uniformity,logged_by";
    return [head, ...rows.filter((w) => w.type === "body").map((w) =>
      [new Date(w.ts).toLocaleDateString(), FARMS[w.farm].name, w.barn, w.body, w.unif, w.by].join(","))].join("\n");
  }
  const head = "date,farm,barn,type,case_lbs,body_lbs,uniformity,logged_by";
  return [head, ...rows.map((w) => [new Date(w.ts).toLocaleDateString(), FARMS[w.farm].name,
    w.barn, w.type, w.caseW != null ? w.caseW : "", w.body != null ? w.body : "",
    w.unif != null ? w.unif : "", w.by].join(","))].join("\n");
}
function CsvPicker({ open, onPick, onClose }) {
  if (!open) return null;
  const opts = [
    ["all", T("All data", "Todos los datos")],
    ["mort", T("Mortality only", "Solo mortalidad")],
    ["case", T("Case weights only", "Solo peso de cajas")],
    ["body", T("Body weight & uniformity", "Peso corporal y uniformidad")],
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 70,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 24, maxWidth: 360, width: "100%" }}>
        <div style={{ fontFamily: font.disp, fontSize: 22, fontWeight: 700,
          textTransform: "uppercase", marginBottom: 14 }}>{T("Export what?", "¿Qué exportar?")}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {opts.map(([k, lbl]) => (
            <button key={k} onClick={() => onPick(k)} style={{ background: C.panel2,
              border: `1px solid ${C.line}`, color: C.text, borderRadius: 8,
              padding: "13px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              textAlign: "left" }}>{lbl}</button>
          ))}
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.line}`,
            color: C.mut, borderRadius: 8, padding: "11px 14px", fontSize: 13,
            cursor: "pointer" }}>{T("Cancel", "Cancelar")}</button>
        </div>
      </div>
    </div>
  );
}
function csvText(rows) {
  const head = "date,time,farm,barn,floor,row,section,tier,cause,logged_by";
  const lines = rows.map((e) => {
    const d = new Date(e.ts);
    return [d.toLocaleDateString(), d.toLocaleTimeString(), FARMS[e.farm].name, e.barn,
      e.floor, e.row, e.section, e.tier,
      CAUSES.find((c) => c.id === e.cause).label, e.user].join(",");
  });
  return [head, ...lines].join("\n");
}
function CsvModal({ csv, onClose }) {
  const ref = useRef(null);
  const [msg, setMsg] = useState(null);
  if (!csv) return null;
  const copy = () => {
    try {
      ref.current.focus(); ref.current.select();
      const ok = document.execCommand("copy");
      setMsg(ok ? T("Copied — paste into Excel or Google Sheets", "Copiado — pégalo en Excel o Google Sheets")
        : T("Text selected — press Ctrl+C to copy", "Texto seleccionado — presiona Ctrl+C para copiar"));
    } catch { setMsg(T("Text selected — press Ctrl+C to copy", "Texto seleccionado — presiona Ctrl+C para copiar")); }
  };
  const dl = () => {
    try {
      const blob = new Blob([csv.text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = csv.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setMsg(T("If nothing downloaded, this preview blocks downloads — use Copy instead", "Si no se descargó nada, esta vista bloquea descargas — usa Copiar"));
    } catch { setMsg(T("Downloads are blocked here — use Copy instead", "Las descargas están bloqueadas aquí — usa Copiar")); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 70,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 20, maxWidth: 640, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: font.disp, fontSize: 20, fontWeight: 700,
            textTransform: "uppercase" }}>{T("Export", "Exportar")} — {csv.name}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.line}`,
            color: C.mut, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>✕</button>
        </div>
        <textarea ref={ref} readOnly value={csv.text} onFocus={(e) => e.target.select()}
          style={{ width: "100%", height: 200, background: C.panel2, color: C.text,
            border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: font.mono,
            fontSize: 12, padding: 10, whiteSpace: "pre", resize: "vertical",
            boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center",
          flexWrap: "wrap" }}>
          <button onClick={copy} style={{ background: C.amber, color: "#15181C", fontWeight: 600,
            border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14,
            cursor: "pointer" }}>{T("Copy", "Copiar")}</button>
          <button onClick={dl} style={{ background: C.panel2, color: C.text,
            border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 18px", fontSize: 14,
            cursor: "pointer" }}>{T("Download .csv", "Descargar .csv")}</button>
          {msg && <div style={{ fontSize: 12, color: C.mut }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
function WeightModal({ farmId, barns, defaultBarn, online, entries, onSave, onDelete, onClose }) {
  const [barn, setBarn] = useState(defaultBarn || barns[0]);
  const [f, setF] = useState({ caseW: "", body: "", unif: "" });
  const [msg, setMsg] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const caseOk = parseFloat(f.caseW) > 0;
  const bodyOk = parseFloat(f.body) > 0 && parseFloat(f.unif) > 0
    && parseFloat(f.unif) <= 100;
  const dirty = f.caseW !== "" || f.body !== "" || f.unif !== "";
  const recent = (entries || []).filter((w) => w.barn === barn)
    .sort((a, b) => b.ts - a.ts).slice(0, 5);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3200); };
  const savedMsg = () => flash(online
    ? T("Saved ✓", "Guardado ✓")
    : T("No signal — saved on phone, will send when reconnected",
        "Sin señal — guardado en el teléfono, se enviará al reconectar"));
  const saveCase = () => {
    onSave({ barn, type: "case", caseW: parseFloat(f.caseW) });
    setF((o) => ({ ...o, caseW: "" })); savedMsg();
  };
  const saveBody = () => {
    onSave({ barn, type: "body", body: parseFloat(f.body), unif: parseFloat(f.unif) });
    setF((o) => ({ ...o, body: "", unif: "" })); savedMsg();
  };
  const tryClose = () => { if (dirty) setConfirmClose(true); else onClose(); };
  const saveAndClose = () => {
    if (caseOk) onSave({ barn, type: "case", caseW: parseFloat(f.caseW) });
    if (bodyOk) onSave({ barn, type: "body", body: parseFloat(f.body),
      unif: parseFloat(f.unif) });
    onClose();
  };
  const saveBtn = (ok) => ({ background: ok ? C.amber : C.panel,
    color: ok ? "#15181C" : C.dis, fontWeight: 600,
    border: `1px solid ${ok ? C.amber : C.line}`, borderRadius: 8,
    padding: "14px 18px", fontSize: 14, cursor: ok ? "pointer" : "default" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 70,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 24, maxWidth: 460, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: font.disp, fontSize: 22, fontWeight: 700,
            textTransform: "uppercase" }}>
            {T("Log weights", "Registrar pesos")} — {FARMS[farmId].name}</div>
          <div style={{ flex: 1 }} />
          <button onClick={tryClose} style={{ background: "none", border: `1px solid ${C.line}`,
            color: C.mut, borderRadius: 6, padding: "3px 10px", cursor: "pointer",
            fontSize: 16 }}>✕</button>
        </div>
        <Eyebrow>{T("Barn", "Galpón")}</Eyebrow>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {barns.map((b) => (
            <button key={b} onClick={() => setBarn(b)} style={{ fontFamily: font.mono,
              fontSize: 15, fontWeight: 600, padding: "12px 20px", borderRadius: 8,
              cursor: "pointer", background: barn === b ? C.amber : C.panel2,
              color: barn === b ? "#15181C" : C.text,
              border: `1px solid ${barn === b ? C.amber : C.line}` }}>{b}</button>
          ))}
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "12px 14px",
          marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: C.mut, display: "grid", gap: 4,
              flex: "1 1 120px" }}>{T("Case weight (lbs)", "Peso de caja (lbs)")}
              <input type="number" step="0.1" inputMode="decimal" value={f.caseW}
                onChange={(e) => setF((o) => ({ ...o, caseW: e.target.value }))}
                style={{ ...inputStyle, width: "100%", fontFamily: font.mono, fontSize: 18 }} />
            </label>
            <button disabled={!caseOk} onClick={saveCase} style={saveBtn(caseOk)}>
              {T("Log case", "Registrar caja")}</button>
          </div>
        </div>
        <div style={{ background: C.panel2, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: C.mut, display: "grid", gap: 4,
              flex: "1 1 110px" }}>{T("Avg body wt (lbs)", "Peso corporal prom. (lbs)")}
              <input type="number" step="0.01" inputMode="decimal" value={f.body}
                onChange={(e) => setF((o) => ({ ...o, body: e.target.value }))}
                style={{ ...inputStyle, width: "100%", fontFamily: font.mono, fontSize: 18 }} />
            </label>
            <label style={{ fontSize: 12, color: C.mut, display: "grid", gap: 4,
              flex: "1 1 110px" }}>{T("Uniformity (%)", "Uniformidad (%)")}
              <input type="number" step="1" inputMode="decimal" value={f.unif}
                onChange={(e) => setF((o) => ({ ...o, unif: e.target.value }))}
                style={{ ...inputStyle, width: "100%", fontFamily: font.mono, fontSize: 18,
                  borderColor: f.body && !f.unif ? C.red : C.line }} />
            </label>
            <button disabled={!bodyOk} onClick={saveBody} style={saveBtn(bodyOk)}>
              {T("Log body wt", "Registrar peso")}</button>
          </div>
          <div style={{ fontSize: 12, color: C.mut, marginTop: 8 }}>
            {T("Enter both numbers straight off the scale readout.",
               "Ingresa ambos números directamente de la báscula.")}
          </div>
        </div>
        {msg && <div style={{ marginTop: 12, fontFamily: font.mono, fontSize: 13,
          color: online ? C.green : C.red }}>{msg}</div>}
        {recent.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Eyebrow>{T("Your latest entries — barn", "Tus últimos registros — galpón")} {barn}</Eyebrow>
            <div style={{ display: "grid", gap: 6 }}>
              {recent.map((w) => (
                <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10,
                  background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
                  padding: "8px 12px", fontFamily: font.mono, fontSize: 13 }}>
                  <span style={{ color: C.mut }}>
                    {new Date(w.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  <span style={{ flex: 1 }}>
                    {w.type === "case"
                      ? `${T("Case", "Caja")} ${w.caseW} lbs`
                      : `${T("Body", "Corporal")} ${w.body} lbs · ${w.unif}%`}</span>
                  <button onClick={() => confirmDelId === w.id
                      ? (onDelete(w.id), setConfirmDelId(null))
                      : setConfirmDelId(w.id)}
                    title={confirmDelId === w.id
                      ? T("Tap again to confirm delete", "Toca de nuevo para confirmar")
                      : T("Delete this entry", "Eliminar este registro")}
                    style={{ background: confirmDelId === w.id ? C.red : "none",
                      border: `1px solid ${confirmDelId === w.id ? C.red : C.line}`,
                      color: confirmDelId === w.id ? "#fff" : C.red, fontWeight: confirmDelId === w.id ? 700 : 400,
                      borderRadius: 6, padding: "4px 10px", fontSize: confirmDelId === w.id ? 12 : 14, cursor: "pointer" }}>
                    ✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {confirmClose && (
          <div style={{ marginTop: 16, background: C.panel2, border: `1px solid ${C.red}`,
            borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              {T("You typed numbers that aren't logged yet. Save them before closing?",
                 "Escribiste números que aún no se registraron. ¿Guardarlos antes de cerrar?")}
              {dirty && !caseOk && !bodyOk && (
                <span style={{ color: C.mut }} > {T("(entries are incomplete — finish them or discard)",
                  "(los registros están incompletos — complétalos o descarta)")}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={!caseOk && !bodyOk} onClick={saveAndClose}
                style={{ background: caseOk || bodyOk ? C.amber : C.panel,
                  color: caseOk || bodyOk ? "#15181C" : C.dis, fontWeight: 600,
                  border: `1px solid ${caseOk || bodyOk ? C.amber : C.line}`, borderRadius: 8,
                  padding: "10px 16px", fontSize: 14,
                  cursor: caseOk || bodyOk ? "pointer" : "default" }}>
                {T("Save & close", "Guardar y cerrar")}</button>
              <button onClick={onClose} style={{ background: "none", color: C.red,
                border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 16px",
                fontSize: 14, cursor: "pointer" }}>{T("Discard", "Descartar")}</button>
              <button onClick={() => setConfirmClose(false)} style={{ background: C.panel,
                color: C.text, border: `1px solid ${C.line}`, borderRadius: 8,
                padding: "10px 16px", fontSize: 14, cursor: "pointer" }}>
                {T("Keep editing", "Seguir editando")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
/* ================= APP ================= */
export default function App() {
  const [screen, setScreen] = useState("signin"); // signin | barn | log | farm | region
  const [user, setUser] = useState(null);
  const [pin, setPin] = useState("");
  const [picked, setPicked] = useState(null);
  const [barn, setBarn] = useState(null);
  const [floor, setFloor] = useState(null);
  const [row, setRow] = useState(null);
  const [section, setSection] = useState(null);
  const [tier, setTier] = useState(null);
  const [session, setSession] = useState([]);
  const [saved, setSaved] = useState([]); // mortality entries — loaded from DB after sign-in
  const [tasks, setTasks] = useState([]);
  const [weights, setWeights] = useState([]);
  const [flocks, setFlocks] = useState({});
  const [weather] = useState(seedWeather);
  const [standards, setStandards] = useState({}); // farmId -> anchor rows
  const [popByTier, setPopByTier] = useState({});
  const [popByRow, setPopByRow] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [bootName, setBootName] = useState("");
  const [bootPin, setBootPin] = useState("");
  const [guide, setGuide] = useState(false); // first-run quick guide
  const [barnConfig, setBarnConfig] = useState({}); // "farm-barn" -> { rows, tiers } overrides
  const [farmBarns, setFarmBarns] = useState(() =>
    Object.fromEntries(Object.keys(FARMS).map((k) => [k, [...FARMS[k].barns]])));
  const [flagThresh, setFlagThresh] = useState({}); // farmId -> hot-spot threshold (fixed mode)
  const [flagMode, setFlagMode] = useState({}); // farmId -> "auto" | "fixed"
  const [lang, setLang] = useState("en");
  const [theme, setTheme] = useState("dark");
  const [netOnline, setNetOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendingSync, setPendingSync] = useState([]);
  const [pendingW, setPendingW] = useState([]);
  const [wModal, setWModal] = useState(false);
  const online = netOnline;
  const [toast, setToast] = useState(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [viewFarm, setViewFarm] = useState(null);
  const narrow = useNarrow();
  // The farm this user walks barns in: own farm, or (district) the farm being viewed
  const walkFarm = user ? (user.farm || viewFarm) : null;
  const myFarmCfg = walkFarm ? FARMS[walkFarm] : null;
  const walkBC = walkFarm && barn ? barnCfg(walkFarm, barn, barnConfig) : null;
  const spotReady = row && section && tier;
  const lastAction = useRef(null);
  const touch = () => { lastAction.current = Date.now(); };
  useEffect(() => {
    if (screen !== "log") return;
    const iv = setInterval(() => {
      if (lastAction.current && Date.now() - lastAction.current > 90000 && (row || section || tier)) {
        setRow(null); setSection(null); setTier(null); lastAction.current = null;
        setToast(STR.spotCleared[lang === "es" ? 1 : 0]);
        setTimeout(() => setToast(null), 2600);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [screen, row, section, tier, lang]);
  useEffect(() => {
    const up = () => setNetOnline(true), down = () => setNetOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  // Real account directory (public.directory view — name/role/farm only, no
  // secrets). Empty result means nobody has been provisioned yet: bootstrap screen.
  async function loadDirectory() {
    const { data, error } = await supabase.from("directory").select("*");
    if (!error) {
      setAccounts((data || []).map((r) => ({ id: r.id, name: r.name, role: r.role, farm: r.farm_id })));
    }
    setDirectoryReady(true);
  }
  useEffect(() => { loadDirectory(); }, []);
  // ---- Mortality entries: real database reads/writes ----
  const dbEntry = (r) => ({ id: r.id, ts: new Date(r.ts).getTime(),
    user: (r.profiles && r.profiles.name) || "—", uid: r.user_id, farm: r.farm_id,
    barn: r.barn, floor: r.floor, row: r.row, section: r.section, tier: r.tier,
    cause: r.cause });
  async function loadEntries() {
    // RLS scopes this automatically: workers/managers get their farm, district gets all.
    const { data, error } = await supabase.from("mortality_entries")
      .select("*, profiles(name)").order("ts", { ascending: true });
    if (!error) setSaved((data || []).map(dbEntry));
    return !error;
  }
  async function pushEntries(list) {
    if (!list.length) return true;
    const rows = list.map((e) => ({ id: e.id, ts: new Date(e.ts).toISOString(),
      user_id: e.uid, farm_id: e.farm, barn: e.barn, floor: e.floor,
      row: e.row, section: e.section, tier: e.tier, cause: e.cause }));
    // Upsert on id: retrying a failed/offline sync can never create duplicates.
    const { error } = await supabase.from("mortality_entries")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    return !error;
  }
  async function deleteEntry(id) {
    const { error } = await supabase.from("mortality_entries").delete().eq("id", id);
    if (error) {
      setToast(T("Delete failed — check connection", "No se pudo borrar — revisa la conexión"));
      setTimeout(() => setToast(null), 2600);
      return;
    }
    setSaved((db) => db.filter((x) => x.id !== id));
  }
  // ---- Weights ----
  const dbWeight = (r) => ({ id: r.id, ts: new Date(r.ts).getTime(),
    by: (r.profiles && r.profiles.name) || "—", uid: r.user_id, farm: r.farm_id,
    barn: r.barn, type: r.type,
    caseW: r.case_lbs != null ? Number(r.case_lbs) : undefined,
    body: r.body_lbs != null ? Number(r.body_lbs) : undefined,
    unif: r.uniformity != null ? Number(r.uniformity) : undefined });
  async function loadWeights() {
    const { data, error } = await supabase.from("weight_entries")
      .select("*, profiles(name)").order("ts", { ascending: true });
    if (!error) setWeights((data || []).map(dbWeight));
  }
  async function pushWeights(list) {
    if (!list.length) return true;
    const rows = list.map((w) => ({ id: w.id, ts: new Date(w.ts).toISOString(),
      user_id: w.uid, farm_id: w.farm, barn: w.barn, type: w.type,
      case_lbs: w.caseW != null ? w.caseW : null,
      body_lbs: w.body != null ? w.body : null,
      uniformity: w.unif != null ? w.unif : null }));
    const { error } = await supabase.from("weight_entries")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    return !error;
  }
  async function deleteWeight(id) {
    setPendingW((q) => q.filter((w) => w.id !== id));
    const { error } = await supabase.from("weight_entries").delete().eq("id", id);
    if (!error) setWeights((ws) => ws.filter((w) => w.id !== id));
  }
  async function clearBarnWeights(farmId, barnCode) {
    const { error } = await supabase.from("weight_entries").delete()
      .eq("farm_id", farmId).eq("barn", barnCode);
    if (!error) setWeights((ws) => ws.filter((w) => !(w.farm === farmId && w.barn === barnCode)));
  }
  // ---- Tasks ----
  const nameOf = (uid) => { const a = accounts.find((x) => x.id === uid); return a ? a.name : null; };
  const dbTask = (r) => ({ id: r.id, farm: r.farm_id, barn: r.barn, floor: r.floor,
    text: r.text, assignedTo: r.assigned_to ? nameOf(r.assigned_to) : null,
    assignedToId: r.assigned_to, due: r.due, status: r.status,
    doneBy: r.done_by ? nameOf(r.done_by) : null,
    doneTs: r.done_ts ? new Date(r.done_ts).getTime() : null });
  async function loadTasks() {
    const { data, error } = await supabase.from("tasks")
      .select("*").order("created_at", { ascending: true });
    if (!error) setTasks((data || []).map(dbTask));
  }
  async function createTask(t) {
    const aid = t.assignedToId ||
      (t.assignedTo ? (accounts.find((a) => a.name === t.assignedTo) || {}).id : null) || null;
    const row = { farm_id: t.farm, barn: t.barn, floor: t.floor, text: t.text,
      assigned_to: aid, due: t.due || null, created_by: user.id };
    const { data, error } = await supabase.from("tasks").insert(row).select("*").single();
    if (!error && data) setTasks((ts) => [...ts, dbTask(data)]);
    return !error;
  }
  async function completeTask(id) {
    const patch = { status: "done", done_by: user.id, done_ts: new Date().toISOString() };
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (!error) setTasks((ts) => ts.map((x) => x.id === id
      ? { ...x, status: "done", doneBy: user.name, doneTs: Date.now() } : x));
  }
  async function deleteTask(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) setTasks((ts) => ts.filter((x) => x.id !== id));
  }
  // ---- Flocks ----
  async function loadFlocks() {
    const { data, error } = await supabase.from("flocks").select("*");
    if (!error) setFlocks(Object.fromEntries((data || []).map((r) => [
      `${r.farm_id}-${r.barn}`,
      { placedTs: r.placed_ts ? new Date(r.placed_ts).getTime() : null,
        ageWk: r.age_wk, breed: r.breed || undefined,
        startPop: r.start_pop != null ? r.start_pop : undefined }])));
  }
  async function updateFlock(key, val) {
    setFlocks((m) => ({ ...m, [key]: val }));
    const dash = key.indexOf("-");
    const farmId = key.slice(0, dash), barnCode = key.slice(dash + 1);
    await supabase.from("flocks").upsert({ farm_id: farmId, barn: barnCode,
      placed_ts: val.placedTs ? new Date(val.placedTs).toISOString() : null,
      age_wk: val.ageWk != null ? val.ageWk : null,
      breed: val.breed || null,
      start_pop: val.startPop != null ? val.startPop : null }, { onConflict: "farm_id,barn" });
  }
  // Depopulation: snapshot the whole flock into flock_archives, then clear the
  // live records for that barn so the next flock starts clean. Managers and
  // district can review archives in the barn's Past flocks list.
  async function archiveAndResetFlock(farmId, barnCode) {
    const flk = flocks[`${farmId}-${barnCode}`] || {};
    const mort = saved.filter((e) => e.farm === farmId && e.barn === barnCode);
    const wts = weights.filter((w) => w.farm === farmId && w.barn === barnCode);
    const { error } = await supabase.from("flock_archives").insert({
      farm_id: farmId, barn: barnCode, breed: flk.breed || null,
      placed_ts: flk.placedTs ? new Date(flk.placedTs).toISOString() : null,
      start_pop: flk.startPop != null ? flk.startPop : null,
      total_deaths: mort.length,
      mortality: mort, weights: wts, created_by: user.id });
    if (error) {
      setToast(T("Couldn't archive the flock — nothing was cleared", "No se pudo archivar la parvada — no se borró nada"));
      setTimeout(() => setToast(null), 3200);
      return false;
    }
    // Archive saved — now clear live rows for this barn
    await Promise.all([
      supabase.from("mortality_entries").delete().eq("farm_id", farmId).eq("barn", barnCode),
      supabase.from("weight_entries").delete().eq("farm_id", farmId).eq("barn", barnCode),
      supabase.from("population_rows").delete().eq("farm_id", farmId).eq("barn", barnCode),
      supabase.from("population_tiers").delete().eq("farm_id", farmId).eq("barn", barnCode),
    ]);
    setSaved((db) => db.filter((e) => !(e.farm === farmId && e.barn === barnCode)));
    setWeights((ws) => ws.filter((w) => !(w.farm === farmId && w.barn === barnCode)));
    const dropBarn = (m) => Object.fromEntries(Object.entries(m)
      .filter(([k]) => !k.startsWith(`${farmId}-${barnCode}-`)));
    setPopByRow(dropBarn); setPopByTier(dropBarn);
    await updateFlock(`${farmId}-${barnCode}`, { placedTs: null, ageWk: 17 });
    setToast(T("Flock archived ✓ — barn reset", "Parvada archivada ✓ — galpón reiniciado"));
    setTimeout(() => setToast(null), 2600);
    return true;
  }
  // ---- Population (row-level counts) ----
  const popKeyParts = (key) => { const p = key.split("-");
    return { farmId: p[0], floor: p[p.length - 1], barn: p.slice(1, -1).join("-") }; };
  async function loadPop() {
    const [tiers, rows] = await Promise.all([
      supabase.from("population_tiers").select("*"),
      supabase.from("population_rows").select("*"),
    ]);
    if (!tiers.error) {
      const m = {};
      (tiers.data || []).forEach((r) => {
        const k = `${r.farm_id}-${r.barn}-${r.floor}`;
        (m[k] = m[k] || [])[r.tier - 1] = r.population;
      });
      setPopByTier(m);
    }
    if (!rows.error) {
      const m = {};
      (rows.data || []).forEach((r) => {
        const k = `${r.farm_id}-${r.barn}-${r.floor}`;
        (m[k] = m[k] || [])[r.row_num - 1] = r.population;
      });
      setPopByRow(m);
    }
  }
  async function saveRowPop(key, arr) {
    setPopByRow((p) => ({ ...p, [key]: arr }));
    const { farmId, barn: barnCode, floor: floorName } = popKeyParts(key);
    const rows = arr.map((v, i) => ({ farm_id: farmId, barn: barnCode,
      floor: floorName, row_num: i + 1, population: v || 0 }));
    await supabase.from("population_rows").upsert(rows,
      { onConflict: "farm_id,barn,floor,row_num" });
  }
  // ---- Config: breed standards, flag settings, barn layouts (debounced write-through) ----
  const hydrated = useRef(false);
  const syncTimers = useRef({});
  const debounced = (name, fn) => {
    if (!hydrated.current) return;
    clearTimeout(syncTimers.current[name]);
    syncTimers.current[name] = setTimeout(fn, 900);
  };
  useEffect(() => { debounced("standards", () => {
    const num = (x) => { const v = parseFloat(x); return isNaN(v) ? 0 : v; };
    const rows = [];
    Object.keys(standards).forEach((f) => (standards[f] || []).forEach((r) => {
      rows.push({ farm_id: f, wk: parseInt(r.wk, 10), mort: num(r.mort),
        case_lbs: num(r.caseW), body_lbs: num(r.body), unif: num(r.unif) });
    }));
    if (rows.length) supabase.from("breed_standards")
      .upsert(rows, { onConflict: "farm_id,wk" }).then(() => {});
  }); }, [standards]);
  useEffect(() => { debounced("flags", () => {
    const farms = [...new Set([...Object.keys(flagThresh), ...Object.keys(flagMode)])];
    const rows = farms.map((f) => ({ farm_id: f, mode: flagMode[f] || "auto",
      threshold: flagThresh[f] || FLAG_THRESHOLD }));
    if (rows.length) supabase.from("flag_settings")
      .upsert(rows, { onConflict: "farm_id" }).then(() => {});
  }); }, [flagThresh, flagMode]);
  useEffect(() => { debounced("barns", () => {
    const rows = [];
    Object.keys(farmBarns).forEach((f) => (farmBarns[f] || []).forEach((code) => {
      const o = barnConfig[`${f}-${code}`] || {};
      rows.push({ farm_id: f, code, rows: o.rows != null ? o.rows : null,
        tiers: o.tiers != null ? o.tiers : null,
        floor_count: o.floors ? o.floors.length : null });
    }));
    if (rows.length) supabase.from("barns")
      .upsert(rows, { onConflict: "farm_id,code" }).then(() => {});
  }); }, [farmBarns, barnConfig]);
  async function loadConfig() {
    const [farms, barns, stds, flags] = await Promise.all([
      supabase.from("farms").select("*"),
      supabase.from("barns").select("*"),
      supabase.from("breed_standards").select("*").order("wk"),
      supabase.from("flag_settings").select("*"),
    ]);
    if (!farms.error) (farms.data || []).forEach((r) => {
      if (!FARMS[r.id]) FARMS[r.id] = { name: r.name, state: r.state || "—",
        barns: [], floors: floorLabels(r.default_floor_count),
        rows: r.default_rows, tiers: r.default_tiers,
        defaultTierPop: r.default_tier_pop };
    });
    if (!barns.error) {
      const fb = {}, bcfg = {};
      (barns.data || []).forEach((r) => {
        (fb[r.farm_id] = fb[r.farm_id] || []).push(r.code);
        const o = {};
        if (r.rows != null) o.rows = r.rows;
        if (r.tiers != null) o.tiers = r.tiers;
        if (r.floor_count != null) o.floors = floorLabels(r.floor_count);
        if (Object.keys(o).length) bcfg[`${r.farm_id}-${r.code}`] = o;
      });
      Object.keys(fb).forEach((f) => { if (FARMS[f]) FARMS[f].barns = fb[f]; });
      setFarmBarns(fb); setBarnConfig(bcfg);
    }
    if (!stds.error) {
      const m = {};
      (stds.data || []).forEach((r) => {
        (m[r.farm_id] = m[r.farm_id] || []).push({ wk: r.wk, mort: Number(r.mort),
          caseW: Number(r.case_lbs), body: Number(r.body_lbs), unif: Number(r.unif) });
      });
      setStandards(m);
    }
    if (!flags.error) {
      const th = {}, md = {};
      (flags.data || []).forEach((r) => { th[r.farm_id] = r.threshold; md[r.farm_id] = r.mode; });
      setFlagThresh(th); setFlagMode(md);
    }
  }
  async function loadAll() {
    hydrated.current = false;
    await Promise.all([loadEntries(), loadWeights(), loadTasks(), loadFlocks(),
      loadPop(), loadConfig()]);
    setTimeout(() => { hydrated.current = true; }, 300);
  }
  const flushing = useRef(false);
  useEffect(() => {
    if (!online || !pendingSync.length || flushing.current) return;
    flushing.current = true;
    const batch = pendingSync;
    pushEntries(batch).then((ok) => {
      flushing.current = false;
      if (!ok) return; // still can't reach the server — keep the queue, retry later
      const n = batch.length;
      setSaved((db) => [...db, ...batch]);
      setPendingSync((q) => q.filter((e) => !batch.some((b) => b.id === e.id)));
      setToast(lang === "es" ? `${n} aves sincronizadas ✓` : `Synced ${n} birds ✓`);
      setTimeout(() => setToast(null), 2600);
    });
  }, [online, pendingSync]);
  const flushingW = useRef(false);
  useEffect(() => {
    if (!online || !pendingW.length || flushingW.current) return;
    flushingW.current = true;
    const batch = pendingW;
    pushWeights(batch).then((ok) => {
      flushingW.current = false;
      if (!ok) return;
      const n = batch.length;
      setWeights((ws) => [...ws, ...batch]);
      setPendingW((q) => q.filter((e) => !batch.some((b) => b.id === e.id)));
      setToast(lang === "es" ? `${n} pesos sincronizados ✓` : `Synced ${n} weight checks ✓`);
      setTimeout(() => setToast(null), 2600);
    });
  }, [online, pendingW]);
  function saveWeight(rec) {
    const e = { id: crypto.randomUUID(), ts: Date.now(), farm: walkFarm,
      by: user.name, uid: user.id, ...rec };
    if (!online) { setPendingW((q) => [...q, e]); return; }
    pushWeights([e]).then((ok) => {
      if (ok) setWeights((ws) => [...ws, e]);
      else setPendingW((q) => [...q, e]);
    });
  }
  async function signIn(u, enteredPin) {
    setAuthErr(""); setAuthBusy(true);
    const email = emailFor(u.name, u.farm);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: enteredPin });
    if (error) {
      setAuthBusy(false); setPin("");
      setAuthErr(T("Wrong PIN — try again", "PIN incorrecto — intenta de nuevo"));
      return;
    }
    const { data: profile, error: pErr } = await supabase.from("profiles")
      .select("*").eq("id", data.user.id).single();
    setAuthBusy(false);
    if (pErr || !profile) {
      setAuthErr(T("Couldn't load your account — try again", "No se pudo cargar tu cuenta — intenta de nuevo"));
      setPin(""); await supabase.auth.signOut();
      return;
    }
    const signedIn = { id: profile.id, name: profile.name, role: profile.role, farm: profile.farm_id };
    setUser(signedIn); setPin(""); setPicked(null);
    loadAll();
    try { if (!localStorage.getItem("flocklog_guide_v1")) setGuide(true); } catch {}
    if (signedIn.role === "district") { setViewFarm("hawkeye"); setScreen("region"); }
    else if (signedIn.role === "manager") { setViewFarm(signedIn.farm); setScreen("farm"); }
    else setScreen("barn");
  }
  function signOut() {
    supabase.auth.signOut();
    setUser(null); setScreen("signin"); setSession([]); setViewFarm(null);
    setBarn(null); setFloor(null); setRow(null); setSection(null); setTier(null);
    setSaved([]); setWeights([]); setTasks([]); setFlocks({});
    setPopByTier({}); setPopByRow({}); // per-user data; next sign-in reloads
    hydrated.current = false;
  }
  async function bootstrapAccount() {
    setAuthErr(""); setAuthBusy(true);
    const { error } = await supabase.functions.invoke("provision-account", {
      body: { name: bootName.trim(), pin: bootPin, role: "district", farm_id: null },
    });
    if (error) {
      // Surface the server's real error message, not a generic one.
      let msg = error.message || String(error);
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          if (body && body.error) msg = body.error;
        }
      } catch {}
      setAuthBusy(false);
      setAuthErr(msg);
      return;
    }
    await signIn({ name: bootName.trim(), farm: null }, bootPin);
    setAuthBusy(false); setBootName(""); setBootPin("");
    await loadDirectory();
  }
  function logBird(causeId) {
    touch();
    const e = { id: crypto.randomUUID(), ts: Date.now(), user: user.name, uid: user.id,
      farm: walkFarm, barn, floor, row, section, tier, cause: causeId };
    setSession((s) => [...s, e]);
    setToast(`+1  ·  ${tr("row")} ${row} · ${secLbl(section)} · ${tr("tier")} ${tier} · ${causeLbl(CAUSES.find((x) => x.id === causeId))}`);
    setTimeout(() => setToast(null), 1800);
  }
  async function finishBarn() {
    const batch = session;
    setSession([]); setRow(null); setSection(null); setTier(null);
    setConfirmFinish(false); setScreen("barn");
    const ok = online ? await pushEntries(batch) : false;
    if (ok) {
      setSaved((db) => [...db, ...batch]);
    } else {
      // Offline or the save failed — queue it; the flush effect retries.
      setPendingSync((q) => [...q, ...batch]);
      setToast(lang === "es"
        ? "Sin señal — guardado en el teléfono, se enviará al reconectar"
        : "No signal — saved on phone, will send when reconnected");
      setTimeout(() => setToast(null), 3200);
    }
  }
  const canEditViewFarm = user && viewFarm &&
    (user.role === "district" || (user.role === "manager" && user.farm === viewFarm));
  const tr = (k) => STR[k][lang === "es" ? 1 : 0];
  const causeLbl = (c) => (lang === "es" ? c.es : c.label);
  const secLbl = (s, short) => lang === "es" ? SECTION_ES[s]
    : (short && s === "Middle" ? "Mid" : s);
  const floorLbl = (f) => (lang === "es" ? FLOOR_ES[f] || f : f);
  async function addFarm(form) {
    let id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "farm";
    while (FARMS[id]) id += "x";
    const barnCodes = Array.from({ length: form.nBarns }, (_, i) => String(i + 1));
    const { error } = await supabase.from("farms").insert({ id, name: form.name,
      state: form.state || "—", default_rows: form.rows, default_tiers: form.tiers,
      default_floor_count: form.nFloors, default_tier_pop: form.tierPop });
    if (error) {
      setToast(T("Couldn't create farm — only district accounts can", "No se pudo crear la granja"));
      setTimeout(() => setToast(null), 3000);
      return;
    }
    await supabase.from("barns").insert(barnCodes.map((code) => ({ farm_id: id, code })));
    FARMS[id] = { name: form.name, state: form.state || "—", barns: barnCodes,
      floors: floorLabels(form.nFloors), rows: form.rows, tiers: form.tiers,
      defaultTierPop: form.tierPop };
    setFarmBarns((m) => ({ ...m, [id]: barnCodes }));
    // Note: the new farm's manager account is added afterward via that farm's
    // Settings → Accounts (needs a PIN, which this form doesn't collect).
  }
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: font.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>
      {/* ======== TOP BAR ======== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "12px 18px", borderBottom: `1px solid ${C.line}`, background: C.panel }}>
        <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 24,
          textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Flock<span style={{ color: C.amber }}>Log</span>
        </div>
        {user && screen !== "signin" && (
          <>
            <div style={{ fontSize: 13, color: C.mut }}>
              {user.name} · {user.role === "district" ? "District" : `${FARMS[user.farm].name}`}
            </div>
            {barn && screen === "log" && (
              <div style={{ fontFamily: font.mono, fontSize: 13, color: C.amber,
                border: `1px solid ${C.amberDim}`, borderRadius: 6, padding: "3px 10px" }}>
                BARN {barn} · {String(floor).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }} />
            {user.role !== "worker" && (
              <button onClick={() => setScreen("region")} style={navBtn(screen === "region")}>{T("All farms", "Todas las granjas")}</button>
            )}
            {user.role === "manager" && (
              <button onClick={() => { setViewFarm(user.farm); setScreen("farm"); }}
                style={navBtn(screen === "farm" && viewFarm === user.farm)}>{T("My farm", "Mi granja")}</button>
            )}
            {(user.role === "manager" || (user.role === "district" && walkFarm)) && (
              <button onClick={() => setScreen(barn && floor ? "log" : "barn")}
                style={navBtn(screen === "log" || screen === "barn")}>
                {T("Walk barn", "Recorrer galpón")}
                {user.role === "district" ? ` · ${FARMS[walkFarm].name}` : ""}
              </button>
            )}
            {viewFarm && canEditViewFarm && (screen === "farm" || screen === "settings") && (
              <button onClick={() => setScreen(screen === "settings" ? "farm" : "settings")}
                style={navBtn(screen === "settings")}>
                {screen === "settings" ? T("Dashboard", "Panel") : T("Settings", "Ajustes")}
              </button>
            )}
            {walkFarm && (
              <button onClick={() => setWModal(true)}
                style={{ fontFamily: font.mono, fontSize: 12, padding: "6px 10px",
                  borderRadius: 6, background: wModal ? C.amber : C.panel2,
                  color: wModal ? "#15181C" : C.amber,
                  border: `1px solid ${wModal ? C.amber : C.line}`, cursor: "pointer" }}>
                ⚖️ {T("Weights", "Pesos")}
              </button>
            )}
            <div title={T("Device connection status", "Estado de conexión del dispositivo")}
              style={{ fontFamily: font.mono, fontSize: 12, padding: "6px 10px", borderRadius: 6,
                background: online ? C.panel2 : "rgba(255,90,72,0.15)",
                color: online ? C.green : C.red,
                border: `1px solid ${online ? C.line : C.red}` }}>
              {online ? `📶 ${tr("signal")}` : `📵 ${tr("noSignal")}`}
              {pendingSync.length + pendingW.length
                ? ` · ${pendingSync.length + pendingW.length}` : ""}
            </div>
            <button onClick={signOut} style={navBtn(false, true)}>{tr("signOut")}</button>
          </>
        )}
        {(!user || screen === "signin") && <div style={{ flex: 1 }} />}
        <button onClick={() => { const next = theme === "dark" ? "light" : "dark";
            Object.assign(C, THEMES[next]); setTheme(next); }}
          style={navBtn(false)}>
          {theme === "dark" ? (lang === "es" ? "☀️ Claro" : "☀️ Light")
            : (lang === "es" ? "🌙 Oscuro" : "🌙 Dark")}
        </button>
        <button onClick={() => { const next = lang === "en" ? "es" : "en"; LANG = next; setLang(next); }}
          style={navBtn(false)}>{lang === "en" ? "Español" : "English"}</button>
      </div>
      {/* ======== SIGN IN ======== */}
      {screen === "signin" && (
        <div style={{ maxWidth: 480, margin: "50px auto", padding: 20 }}>
          {!directoryReady ? (
            <div style={{ textAlign: "center", color: C.mut, padding: 40 }}>
              {T("Loading accounts…", "Cargando cuentas…")}
            </div>
          ) : accounts.length === 0 ? (
            <>
              <Eyebrow>{T("First-time setup", "Configuración inicial")}</Eyebrow>
              <div style={{ fontSize: 13, color: C.mut, marginBottom: 16 }}>
                {T("No accounts exist yet. Create the first one — it will be a district admin account.",
                  "No hay cuentas todavía. Crea la primera — será una cuenta de administrador de distrito.")}
              </div>
              <input value={bootName} onChange={(e) => setBootName(e.target.value)}
                placeholder={T("Your name", "Tu nombre")}
                style={{ ...inputStyle, width: "100%", marginBottom: 10 }} />
              <input value={bootPin} onChange={(e) => setBootPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={T("4-digit PIN", "PIN de 4 dígitos")} inputMode="numeric"
                style={{ ...inputStyle, width: "100%", marginBottom: 10, fontFamily: font.mono }} />
              {authErr && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{authErr}</div>}
              <button disabled={!bootName.trim() || bootPin.length !== 4 || authBusy}
                onClick={bootstrapAccount}
                style={{ width: "100%", background: (bootName.trim() && bootPin.length === 4 && !authBusy) ? C.amber : C.panel2,
                  color: (bootName.trim() && bootPin.length === 4 && !authBusy) ? "#15181C" : C.dis,
                  fontWeight: 600, border: `1px solid ${C.line}`, borderRadius: 8,
                  padding: "14px 20px", fontSize: 15,
                  cursor: (bootName.trim() && bootPin.length === 4 && !authBusy) ? "pointer" : "default" }}>
                {authBusy ? T("Creating…", "Creando…") : T("Create account & sign in", "Crear cuenta e iniciar sesión")}
              </button>
            </>
          ) : !picked ? (
            <>
              {Object.keys(FARMS).map((f) => (
                <div key={f} style={{ marginBottom: 22 }}>
                  <Eyebrow>{FARMS[f].name} · {FARMS[f].state}</Eyebrow>
                  <div style={{ display: "grid", gap: 8 }}>
                    {accounts.filter((u) => u.farm === f).map((u) => (
                      <Btn key={u.id || u.name} label={u.name}
                        sub={u.role === "manager" ? tr("farmManager") : null}
                        wide on={() => { setAuthErr(""); setPicked(u); }} />
                    ))}
                  </div>
                </div>
              ))}
              <Eyebrow>District</Eyebrow>
              <div style={{ display: "grid", gap: 8 }}>
                {accounts.filter((u) => u.role === "district").map((u) => (
                  <Btn key={u.id || u.name} label={u.name} sub={T("District manager — all farms", "Gerente de distrito — todas las granjas")}
                    wide on={() => { setAuthErr(""); setPicked(u); }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <Eyebrow>{tr("pinFor")} {picked.name}</Eyebrow>
              <div style={{ fontFamily: font.mono, fontSize: 34, textAlign: "center",
                letterSpacing: "0.5em", padding: "10px 0 20px", minHeight: 66 }}>
                {"●".repeat(pin.length)}
              </div>
              {authErr && <div style={{ color: C.red, fontSize: 13, textAlign: "center", marginBottom: 10 }}>{authErr}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[1,2,3,4,5,6,7,8,9,"←",0,"OK"].map((k) => (
                  <button key={k} disabled={authBusy} onClick={() => {
                    if (k === "←") setPin((p) => p.slice(0, -1));
                    else if (k === "OK") { if (pin.length === 4 && !authBusy) signIn(picked, pin); }
                    else if (pin.length < 4) setPin((p) => p + k);
                  }} style={{ fontFamily: font.mono, fontSize: 24, padding: "18px 0",
                    background: k === "OK" && pin.length === 4 ? C.amber : C.panel2,
                    color: k === "OK" && pin.length === 4 ? "#15181C" : C.text,
                    border: `1px solid ${C.line}`, borderRadius: 10, cursor: authBusy ? "default" : "pointer" }}>{k}</button>
                ))}
              </div>
              <button onClick={() => { setPicked(null); setPin(""); setAuthErr(""); }}
                style={{ marginTop: 16, background: "none", border: "none", color: C.mut,
                  fontSize: 14, cursor: "pointer" }}>{"←"} {tr("back")}</button>
            </>
          )}
        </div>
      )}
      {/* ======== BARN SELECT (worker/manager walk, own farm only) ======== */}
      {screen === "barn" && user && myFarmCfg && (
        <div style={{ maxWidth: 760, margin: "40px auto", padding: 20 }}>
          <Eyebrow>{FARMS[walkFarm].name} — {tr("selectBarn")}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28 }}>
            {(farmBarns[walkFarm] || myFarmCfg.barns).map((b) => <Btn key={b} label={b} active={barn === b}
              on={() => { setBarn(b);
                const fl = barnCfg(walkFarm, b, barnConfig).floors;
                if (!fl.includes(floor)) setFloor(fl.length === 1 ? fl[0] : null); }} />)}
          </div>
          <Eyebrow>{tr("floor")}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${(barn ? barnCfg(walkFarm, barn, barnConfig).floors : myFarmCfg.floors).length},1fr)`, gap: 10, marginBottom: 28 }}>
            {(barn ? barnCfg(walkFarm, barn, barnConfig).floors : myFarmCfg.floors).map((f) =>
              <Btn key={f} label={floorLbl(f)} active={floor === f} on={() => setFloor(f)} />)}
          </div>
          <Btn label={tr("startWalk")} wide tall disabled={!barn || !floor}
            active={!!(barn && floor)} on={() => setScreen("log")} />
        </div>
      )}
      {/* ======== LOGGING ======== */}
      {screen === "log" && user && walkBC && (
        <div style={{ padding: 18, maxWidth: 1180, margin: "0 auto" }}>
          <button onClick={() => (session.length ? setConfirmLeave(true) : setScreen("barn"))}
            style={{ background: "none", border: `1px solid ${C.line}`, color: C.mut,
              borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
              marginBottom: 14 }}>
            ← {T("Change barn / floor", "Cambiar galpón / piso")}
          </button>
          {tasks.filter((t) => t.farm === walkFarm && t.barn === barn && t.floor === floor
            && t.status === "open" && (!t.assignedTo || t.assignedTo === user.name)).map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12,
              background: "rgba(255,176,32,0.08)", border: `1px solid ${C.amberDim}`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontSize: 12,
                letterSpacing: "0.12em", color: C.amber }}>{tr("task")}{t.due ? ` · ${t.due}` : ""}</div>
              <div style={{ fontSize: 14, flex: 1 }}>{t.text}
                {t.assignedTo && <span style={{ color: C.mut }}> — {t.assignedTo}</span>}</div>
              <button onClick={() => completeTask(t.id)}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.green,
                  borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer",
                  fontWeight: 600 }}>{tr("markDone")}</button>
            </div>
          ))}
          <Eyebrow>{tr("mapHint")}{narrow ? tr("swipeHint") : ""}</Eyebrow>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginBottom: 24 }}>
          <div style={{ minWidth: walkBC.rows * 62 + Math.floor(walkBC.rows / 2) * 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {Array.from({ length: walkBC.rows }, (_, i) => i + 1).map((r) => (
              <div key={r} style={{ flex: 1, textAlign: "center", fontFamily: font.mono,
                fontSize: 12, color: row === r ? C.amber : C.mut,
                marginRight: r % 2 === 0 && r !== walkBC.rows ? 14 : 0 }}>R{r}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: walkBC.rows }, (_, i) => i + 1).map((r) => (
              <div key={r} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3,
                background: C.panel, border: `1px solid ${row === r ? C.amber : C.line}`,
                borderRadius: 8, padding: 3,
                marginRight: r % 2 === 0 && r !== walkBC.rows ? 14 : 0 }}>
                {SECTIONS.map((s) => {
                  const active = row === r && section === s;
                  return (
                    <button key={s} onClick={() => { touch(); setRow(r); setSection(s); }}
                      style={{ minHeight: 62, borderRadius: 6, cursor: "pointer",
                        background: active ? C.amber : C.panel2,
                        border: `1px solid ${active ? C.amber : C.line}`,
                        color: active ? "#15181C" : C.mut,
                        fontFamily: font.disp, fontWeight: 600, fontSize: 13,
                        textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {secLbl(s, true)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
              <Eyebrow>{tr("tierHint")}</Eyebrow>
              <div style={{ display: "grid", gap: 8,
                gridTemplateColumns: narrow ? "repeat(3, 1fr)" : "1fr" }}>
                {Array.from({ length: walkBC.tiers }, (_, i) => walkBC.tiers - i).map((t) => (
                  <Btn key={t} label={`${tr("tier")} ${t}`} active={tier === t} on={() => { touch(); setTier(t); }} />
                ))}
              </div>
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 280 }}>
              <Eyebrow>{tr("loggingAt")}</Eyebrow>
              <div style={{ background: spotReady ? "rgba(255,176,32,0.1)" : C.panel,
                border: `1px solid ${spotReady ? C.amber : C.line}`, borderRadius: 10,
                padding: "12px 14px", marginBottom: 12, fontFamily: font.disp, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 24,
                color: spotReady ? C.amber : C.dis, textAlign: "center" }}>
                {spotReady ? `${tr("row")} ${row} · ${secLbl(section)} · ${tr("tier")} ${tier}` : tr("pickSpot")}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {CAUSES.map((c) => (
                  <Btn key={c.id} label={causeLbl(c)} wide tall disabled={!spotReady}
                    on={() => logBird(c.id)} />
                ))}
              </div>
              <div style={{ marginTop: 22, background: C.panel, border: `1px solid ${C.line}`,
                borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontFamily: font.mono, fontSize: 34, fontWeight: 600, color: C.amber }}>
                    {session.length}
                  </div>
                  <div style={{ fontSize: 13, color: C.mut }}>{tr("birdsWalk")}</div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setSession((s) => s.slice(0, -1))} disabled={!session.length}
                    style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 8,
                      color: session.length ? C.text : C.dis, padding: "6px 12px",
                      fontSize: 13, cursor: session.length ? "pointer" : "default" }}>{tr("undoLast")}</button>
                </div>
                <div style={{ maxHeight: 130, overflowY: "auto", marginTop: 10 }}>
                  {[...session].reverse().slice(0, 8).map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8,
                      fontFamily: font.mono, fontSize: 12, color: C.mut,
                      padding: "3px 0", borderTop: `1px solid ${C.line}` }}>
                      <span style={{ flex: 1 }}>
                        R{e.row} · {secLbl(e.section)[0]} · T{e.tier} · {causeLbl(CAUSES.find((c) => c.id === e.cause))}
                      </span>
                      <button onClick={() => setConfirmDel(e)} style={{ background: "none",
                        border: `1px solid ${C.line}`, color: C.red, borderRadius: 6,
                        padding: "2px 10px", fontSize: 13, cursor: "pointer",
                        minHeight: 28 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Btn label={`${tr("finishSave")} ${session.length}`} wide tall
                  disabled={!session.length} active={!!session.length} color={C.green}
                  on={() => setConfirmFinish(true)} />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ======== REGION (managers see all, read-only elsewhere; district edits all) ======== */}
      {screen === "region" && user && user.role !== "worker" && (
        <RegionView saved={saved} flocks={flocks} popByTier={popByTier} popByRow={popByRow} barnConfig={barnConfig}
          farmBarns={farmBarns} flagThresh={flagThresh} flagMode={flagMode} weights={weights}
          weather={weather}
          accounts={accounts} isDistrict={user.role === "district"} onAddFarm={addFarm}
          onOpen={(f) => { setViewFarm(f); setScreen("farm"); }} />
      )}
      {/* ======== FARM ADMIN ======== */}
      {screen === "farm" && user && viewFarm && (
        <AdminView key={viewFarm} farmId={viewFarm} canEdit={canEditViewFarm}
          saved={saved} setSaved={setSaved} deleteEntry={deleteEntry}
          addWeight={saveWeight} deleteWeight={deleteWeight} clearBarnWeights={clearBarnWeights}
          updateFlock={updateFlock} saveRowPop={saveRowPop} archiveFlock={archiveAndResetFlock}
          createTask={createTask} deleteTask={deleteTask}
          popByTier={popByTier} setPopByTier={setPopByTier}
          popByRow={popByRow} setPopByRow={setPopByRow}
          tasks={tasks} setTasks={setTasks}
          weights={weights} setWeights={setWeights}
          flocks={flocks} setFlocks={setFlocks} standards={standards} weather={weather}
          accounts={accounts} me={user.name}
          barnConfig={barnConfig} farmBarns={farmBarns} flagThresh={flagThresh}
          flagMode={flagMode} />
      )}
      {/* ======== SETTINGS (own farm or district only) ======== */}
      {screen === "settings" && user && viewFarm && canEditViewFarm && (
        <SettingsView key={viewFarm} farmId={viewFarm}
          barnConfig={barnConfig} setBarnConfig={setBarnConfig}
          farmBarns={farmBarns} setFarmBarns={setFarmBarns}
          accounts={accounts} setAccounts={setAccounts} reloadAccounts={loadDirectory}
          saved={saved} me={user.name}
          flagThresh={flagThresh} setFlagThresh={setFlagThresh}
          flagMode={flagMode} setFlagMode={setFlagMode}
          standards={standards} setStandards={setStandards} />
      )}
      {/* ======== WEIGHT ENTRY (top-bar button, workers + managers) ======== */}
      {wModal && walkFarm && (
        <WeightModal farmId={walkFarm}
          barns={farmBarns[walkFarm] || FARMS[walkFarm].barns}
          defaultBarn={barn}
          entries={[...weights, ...pendingW].filter((w) =>
            w.farm === walkFarm && w.by === user.name)}
          online={online} onSave={saveWeight}
          onDelete={deleteWeight}
          onClose={() => setWModal(false)} />
      )}
      {/* ======== FIRST-RUN GUIDE ======== */}
      {guide && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 90,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 26, maxWidth: 480, width: "100%" }}>
            <div style={{ fontFamily: font.disp, fontSize: 26, fontWeight: 700,
              textTransform: "uppercase", marginBottom: 4 }}>
              {T("Welcome to FlockLog", "Bienvenido a FlockLog")}
            </div>
            <div style={{ color: C.mut, fontSize: 13, marginBottom: 16 }}>
              {T("Quick tour — you'll only see this once.", "Recorrido rápido — solo lo verás una vez.")}
            </div>
            {(user.role === "worker" ? [
              T("Tap Walk barn, pick your barn and floor.", "Toca Recorrer galpón, elige galpón y piso."),
              T("On the map, tap the spot where you found a bird, then the tier, then the cause. That's one bird logged.", "En el mapa, toca el lugar donde encontraste el ave, luego el nivel y la causa. Eso registra un ave."),
              T("Tap Finish barn · save when you're done — that's what sends it in.", "Toca Terminar galpón · guardar al final — eso envía los datos."),
              T("Use the ⚖️ Weights button up top to log case weights and body-weight checks.", "Usa el botón ⚖️ Pesos arriba para registrar pesos."),
              T("Lose signal mid-walk? Keep logging — entries send automatically when signal returns.", "¿Sin señal? Sigue registrando — se envía solo al volver la señal."),
            ] : user.role === "manager" ? [
              T("My farm is your dashboard — mortality, hot spots, weights, and flock status per barn.", "Mi granja es tu panel — mortalidad, puntos críticos, pesos y parvadas por galpón."),
              T("Walk barn lets you log birds yourself, same as a worker.", "Recorrer galpón te deja registrar aves, igual que un trabajador."),
              T("Settings (from your farm page) is where you add accounts, barns, breed standards, and alert rules.", "En Ajustes agregas cuentas, galpones, estándares y alertas."),
              T("Assign tasks from a barn's dashboard — workers see them when they walk that barn.", "Asigna tareas desde el panel del galpón — los trabajadores las ven al recorrerlo."),
              T("All farms shows every farm, but only your own farm's numbers are visible to you.", "Todas las granjas muestra cada granja, pero solo ves los números de la tuya."),
            ] : [
              T("All farms ranks every farm by mortality rate — tap a farm card to open its dashboard.", "Todas las granjas ordena las granjas por mortalidad — toca una para abrir su panel."),
              T("From a farm's page, Settings manages its accounts, barns, and standards.", "Desde una granja, Ajustes maneja sus cuentas, galpones y estándares."),
              T("Walk barn works for whichever farm you're currently viewing.", "Recorrer galpón funciona en la granja que estés viendo."),
              T("Add accounts with a name + 4-digit PIN — that's how each person signs in.", "Agrega cuentas con nombre + PIN de 4 dígitos — así entra cada persona."),
            ]).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 14 }}>
                <span style={{ color: C.amber, fontFamily: font.mono, fontWeight: 600 }}>{i + 1}.</span>
                <span>{s}</span>
              </div>
            ))}
            <button onClick={() => { setGuide(false);
                try { localStorage.setItem("flocklog_guide_v1", "1"); } catch {} }}
              style={{ marginTop: 10, width: "100%", background: C.amber, color: "#15181C",
                fontWeight: 600, border: "none", borderRadius: 8, padding: "14px 20px",
                fontSize: 15, cursor: "pointer" }}>
              {T("Got it", "Entendido")}
            </button>
          </div>
        </div>
      )}
      {/* ======== LEAVE BARN CONFIRM ======== */}
      {confirmLeave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 26, maxWidth: 420, width: "100%" }}>
            <div style={{ fontFamily: font.disp, fontSize: 24, fontWeight: 700,
              textTransform: "uppercase", marginBottom: 6 }}>{T("Leave this barn?", "¿Salir de este galpón?")}</div>
            <div style={{ color: C.mut, fontSize: 14, marginBottom: 18 }}>
              {session.length} {T("unsaved birds — save them first?", "aves sin guardar — ¿guardarlas primero?")}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Btn label={T("Save & change barn", "Guardar y cambiar galpón")} active color={C.green}
                on={() => { setConfirmLeave(false); finishBarn(); }} />
              <Btn label={T("Discard & change barn", "Descartar y cambiar galpón")} active color={C.red}
                on={() => { setSession([]); setRow(null); setSection(null); setTier(null);
                  setConfirmLeave(false); setScreen("barn"); }} />
              <Btn label={tr("keepLogging")} on={() => setConfirmLeave(false)} />
            </div>
          </div>
        </div>
      )}
      {/* ======== DELETE ONE BIRD CONFIRM ======== */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 26, maxWidth: 380, width: "100%" }}>
            <div style={{ fontFamily: font.disp, fontSize: 24, fontWeight: 700,
              textTransform: "uppercase", marginBottom: 8 }}>{tr("delQ")}</div>
            <div style={{ fontFamily: font.mono, fontSize: 14, color: C.mut, marginBottom: 18 }}>
              {tr("row")} {confirmDel.row} · {secLbl(confirmDel.section)} · {tr("tier")} {confirmDel.tier} · {causeLbl(CAUSES.find((c) => c.id === confirmDel.cause))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Btn label={tr("cancel")} on={() => setConfirmDel(null)} />
              <Btn label={tr("del")} active color={C.red} on={() => {
                setSession((s) => s.filter((x) => x.id !== confirmDel.id));
                setConfirmDel(null);
              }} />
            </div>
          </div>
        </div>
      )}
      {/* ======== TOAST ======== */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.amber, color: "#15181C", fontFamily: font.mono, fontSize: 14,
          fontWeight: 600, padding: "12px 22px", borderRadius: 10, zIndex: 50 }}>
          {toast}
        </div>
      )}
      {/* ======== FINISH CONFIRM ======== */}
      {confirmFinish && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 26, maxWidth: 420, width: "100%" }}>
            <div style={{ fontFamily: font.disp, fontSize: 26, fontWeight: 700,
              textTransform: "uppercase", marginBottom: 6 }}>{tr("saveQ")} {barn} · {floorLbl(floor)}?</div>
            <div style={{ color: C.mut, fontSize: 14, marginBottom: 18 }}>
              {session.length} {tr("willCommit")} {user.name}.
            </div>
            {CAUSES.map((c) => {
              const n = session.filter((e) => e.cause === c.id).length;
              return n ? <div key={c.id} style={{ fontFamily: font.mono, fontSize: 14,
                display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ color: C.mut }}>{causeLbl(c)}</span><span>{n}</span></div> : null;
            })}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              <Btn label={tr("keepLogging")} on={() => setConfirmFinish(false)} />
              <Btn label={tr("save")} active color={C.green} on={finishBarn} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function navBtn(active, dim) {
  return { background: active ? C.panel2 : "none", border: `1px solid ${C.line}`,
    color: dim ? C.mut : C.text, borderRadius: 8, padding: "8px 14px",
    fontSize: 13, cursor: "pointer" };
}
/* ================= REGION VIEW ================= */
function RegionView({ saved, flocks, popByTier, popByRow, barnConfig, farmBarns, flagThresh, flagMode,
  weights, weather, accounts, isDistrict, onAddFarm, onOpen }) {
  const wAgg = (fid) => {
    const byCase = {}, byBody = {};
    (weights || []).filter((w) => w.farm === fid).forEach((w) => {
      const m = w.type === "case" ? byCase : byBody;
      (m[w.barn] = m[w.barn] || []).push(w);
    });
    const pick = (m, fn) => {
      const latest = [], prev = [];
      Object.values(m).forEach((arr) => {
        arr.sort((a, b) => b.ts - a.ts);
        if (arr[0]) latest.push(fn(arr[0]));
        if (arr[1]) prev.push(fn(arr[1]));
      });
      const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
      return { now: avg(latest), was: avg(prev) };
    };
    return { c: pick(byCase, (w) => w.caseW), b: pick(byBody, (w) => w.body),
      u: pick(byBody, (w) => w.unif) };
  };
  const now = Date.now();
  const [range, setRange] = useState(7);
  const [csv, setCsv] = useState(null);
  const [csvPick, setCsvPick] = useState(false);
  const rLabel = range === 1 ? "24h" : `${range}-day`;
  const since = now - range * 86400000;
  const doExport = (k) => {
    const mort = saved.filter((e) => e.ts > since);
    const wr = (weights || []).filter((w) => w.ts > since);
    const suf = range === 1 ? "24h" : range + "d";
    let text, name;
    if (k === "mort") { text = csvText(mort); name = `all-farms-mortality-${suf}.csv`; }
    else if (k === "case") { text = weightsCsv(wr, "case"); name = `all-farms-case-weights-${suf}.csv`; }
    else if (k === "body") { text = weightsCsv(wr, "body"); name = `all-farms-body-weights-${suf}.csv`; }
    else { text = csvText(mort) + "\n\n" + weightsCsv(wr, "all"); name = `all-farms-all-data-${suf}.csv`; }
    setCsvPick(false); setCsv({ text, name });
  };
  const farms = Object.keys(FARMS).map((f) => {
    const data = saved.filter((e) => e.farm === f && e.ts > since);
    // Live estimate: entered populations minus deaths logged since each barn's placement
    const popStart = farmPop(f, popByTier, popByRow, barnConfig, farmBarns);
    const fBarns = (farmBarns && farmBarns[f]) || FARMS[f].barns;
    const flockDeaths = fBarns.reduce((a, b) => {
      const flk = (flocks || {})[`${f}-${b}`];
      const pl = flk && flk.placedTs ? flk.placedTs : 0;
      return a + saved.filter((e) => e.farm === f && e.barn === b && e.ts >= pl).length;
    }, 0);
    const pop = Math.max(0, popStart - flockDeaths);
    const rate = pop ? (data.length / pop) * 100 : 0;
    const half = (range * 86400000) / 2;
    const lastH = data.filter((e) => e.ts > now - half).length;
    const prevH = data.length - lastH;
    const trend = lastH > prevH * 1.15 ? "up" : lastH < prevH * 0.85 ? "down" : "flat";
    return { id: f, cfg: FARMS[f], n: data.length, pop, rate, trend, entries: data,
      w: wAgg(f),
      flags: farmFlags(f, saved, barnConfig, farmBarns, flagThresh && flagThresh[f],
        (flagMode && flagMode[f]) || "auto", since) };
  }).sort((a, b) => b.rate - a.rate);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Eyebrow>{LANG === "es" ? `Todas las granjas — mortalidad ${range === 1 ? "24 h" : range + " días"}, por tasa` : `All farms — ${rLabel} mortality, ranked by rate`}</Eyebrow>
        <div style={{ flex: 1 }} />
        <RangeToggle value={range} onChange={setRange} />
        <button onClick={() => setCsvPick(true)}
          style={{ fontFamily: font.mono, fontSize: 12, padding: "8px 12px", borderRadius: 8,
            background: C.panel2, color: C.text, border: `1px solid ${C.line}`,
            cursor: "pointer", marginBottom: 10 }}>
          ⬇ CSV
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {farms.map((f) => (
          <div key={f.id} style={{ flex: "1 1 300px", background: C.panel,
            border: `1px solid ${f.flags ? C.red : C.line}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 24,
                textTransform: "uppercase" }}>{f.cfg.name}</div>
              <div style={{ fontSize: 12, color: C.mut }}>{f.cfg.state}</div>
              {(() => { const w = wxOn(weather && weather[f.id], Date.now());
                return w ? <div title={T("Today's weather at this farm", "Clima de hoy en esta granja")}
                  style={{ fontFamily: font.mono, fontSize: 12,
                    color: w.hi >= 95 ? C.red : w.hi >= 88 ? C.amber : C.mut }}>
                  {w.hi}°F · {w.cond}</div> : null; })()}
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 18 }}>{f.trend === "up" ? "↗" : f.trend === "down" ? "↘" : "→"}</div>
            </div>
            <div style={{ display: "flex", gap: 18, margin: "14px 0" }}>
              <div>
                <div style={{ fontFamily: font.mono, fontSize: 30, fontWeight: 600,
                  color: f.flags ? C.red : C.amber }}>{f.rate.toFixed(2)}%</div>
                <div style={{ fontSize: 11, color: C.mut }}>{LANG === "es" ? "tasa " + (range === 1 ? "24 h" : range + " d") : rLabel + " rate"}</div>
              </div>
              <div>
                <div style={{ fontFamily: font.mono, fontSize: 30, fontWeight: 600 }}>{f.n}</div>
                <div style={{ fontSize: 11, color: C.mut }}>{T("birds", "aves")}</div>
              </div>
              <div>
                <div style={{ fontFamily: font.mono, fontSize: 30, fontWeight: 600 }}>{(f.pop / 1000).toFixed(0)}k</div>
                <div style={{ fontSize: 11, color: C.mut }}>{T("population", "población")}</div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}><TrendBars data={f.entries} days={range}
              wx={weather && weather[f.id]} /></div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12,
              fontFamily: font.mono, fontSize: 13, borderTop: `1px solid ${C.line}`,
              paddingTop: 10 }}>
              {[[T("Case", "Caja"), f.w.c, " lbs", 1], [T("Body", "Peso"), f.w.b, " lbs", 2], ["Unif", f.w.u, "%", 0]]
                .map(([lbl, s, unit, dec]) => s.now != null && (
                <div key={lbl} title={T("Farm average of each barn's latest weekly entry — arrow vs prior week", "Promedio de la última captura semanal de cada galpón — flecha vs semana anterior")}>
                  <span style={{ color: C.mut, fontSize: 11 }}>{lbl} </span>
                  {s.now.toFixed(dec)}{unit}
                  <span style={{ marginLeft: 3,
                    color: s.was == null ? C.mut : s.now > s.was ? C.green
                      : s.now < s.was ? C.red : C.mut }}>
                    {s.was == null ? "" : s.now > s.was ? "↗" : s.now < s.was ? "↘" : "→"}
                  </span>
                </div>
              ))}
            </div>
            {f.flags > 0 && (
              <div style={{ fontFamily: font.mono, fontSize: 13, color: C.red, marginBottom: 12 }}>
                {f.flags} {LANG === "es" ? (f.flags > 1 ? "puntos críticos" : "punto crítico") : `hot spot${f.flags > 1 ? "s" : ""} flagged`}
              </div>
            )}
            <button onClick={() => onOpen(f.id)} style={{ width: "100%",
              background: C.panel2, border: `1px solid ${C.line}`, color: C.text,
              borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {T("Open farm", "Abrir granja")} {"→"}
            </button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.mut, marginTop: 16 }}>
        {T("Rates use each farm's current population — raw counts aren't comparable across farms of different sizes.", "Las tasas usan la población actual de cada granja — los conteos brutos no se comparan entre granjas de distinto tamaño.")}
      </div>
      {isDistrict && <AddFarmPanel onAdd={onAddFarm} accounts={accounts} />}
      <CsvPicker open={csvPick} onPick={doExport} onClose={() => setCsvPick(false)} />
      <CsvModal csv={csv} onClose={() => setCsv(null)} />
    </div>
  );
}
function AddFarmPanel({ onAdd, accounts }) {
  const [open, setOpen] = useState(false);
  const blank = { name: "", state: "", nBarns: 4, nFloors: 2, rows: 10, tiers: 6,
    tierPop: 7500, manager: "" };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const num = (k, lo, hi) => (e) => setF((o) => ({ ...o,
    [k]: Math.max(lo, Math.min(hi, parseInt(e.target.value, 10) || lo)) }));
  const dupMgr = f.manager.trim() &&
    accounts.some((u) => u.name.toLowerCase() === f.manager.trim().toLowerCase());
  const dupFarm = Object.values(FARMS).some((x) =>
    x.name.toLowerCase() === f.name.trim().toLowerCase());
  const ok = f.name.trim() && !dupFarm && !dupMgr;
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ marginTop: 20, background: C.panel2,
      border: `1px dashed ${C.amberDim}`, color: C.amber, borderRadius: 10,
      padding: "14px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
      {T("+ Add a farm", "+ Agregar granja")}
    </button>
  );
  return (
    <div style={{ marginTop: 20, background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: 12, padding: 16 }}>
      <Eyebrow>{T("New farm — district only", "Granja nueva — solo distrito")}</Eyebrow>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={f.name} onChange={set("name")} placeholder={T("Farm name", "Nombre de la granja")}
          style={{ ...inputStyle, flex: "2 1 180px",
            borderColor: dupFarm ? C.red : C.line }} />
        <input value={f.state} onChange={set("state")} placeholder={T("State (e.g. IA)", "Estado (ej. IA)")}
          style={{ ...inputStyle, flex: "1 1 90px", maxWidth: 110 }} />
        <input value={f.manager} onChange={set("manager")}
          placeholder={T("Farm manager name (optional)", "Gerente de la granja (opcional)")}
          style={{ ...inputStyle, flex: "2 1 180px",
            borderColor: dupMgr ? C.red : C.line }} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
        marginBottom: 12 }}>
        {[["nBarns", T("Barns", "Galpones"), 1, 40], ["nFloors", T("Floors", "Pisos"), 1, 3], ["rows", T("Rows", "Filas"), 1, 30],
          ["tiers", T("Tiers", "Niveles"), 1, 12], ["tierPop", T("Birds/tier", "Aves/nivel"), 0, 100000]].map(([k, lbl, lo, hi]) => (
          <label key={k} style={{ fontSize: 13, color: C.mut }}>{lbl}
            <input type="number" value={f[k]} onChange={num(k, lo, hi)}
              style={{ ...inputStyle, width: k === "tierPop" ? 90 : 64, padding: "8px 8px",
                marginLeft: 6, fontFamily: font.mono, textAlign: "right" }} />
          </label>
        ))}
      </div>
      {dupFarm && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>
        {T("A farm with that name already exists.", "Ya existe una granja con ese nombre.")}</div>}
      {dupMgr && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>
        {T("That name already has an account.", "Ese nombre ya tiene una cuenta.")}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button disabled={!ok} onClick={() => {
            onAdd({ ...f, name: f.name.trim(), state: f.state.trim(), manager: f.manager.trim() });
            setF(blank); setOpen(false); }}
          style={{ background: ok ? C.amber : C.panel2, color: ok ? "#15181C" : C.dis,
            fontWeight: 600, border: `1px solid ${ok ? C.amber : C.line}`, borderRadius: 8,
            padding: "12px 22px", fontSize: 14, cursor: ok ? "pointer" : "default" }}>
          {T("Create farm", "Crear granja")}</button>
        <button onClick={() => setOpen(false)} style={{ background: "none",
          border: `1px solid ${C.line}`, color: C.mut, borderRadius: 8, padding: "12px 18px",
          fontSize: 14, cursor: "pointer" }}>{T("Cancel", "Cancelar")}</button>
      </div>
      <div style={{ fontSize: 12, color: C.mut, marginTop: 10 }}>
        {T("Barns are named 1…N to start — rename, resize, or add barns later in that farm's Settings. Add the farm's manager and workers (each with their own PIN) in that farm's Settings → Accounts.", "Los galpones se nombran 1…N al inicio — cámbialos después en los Ajustes de esa granja. Agrega al gerente y trabajadores (cada uno con su PIN) en Ajustes → Cuentas de esa granja.")}
      </div>
    </div>
  );
}
/* ================= FARM ADMIN VIEW ================= */
function AdminView({ farmId, canEdit, saved, setSaved, deleteEntry,
  addWeight, deleteWeight, clearBarnWeights, updateFlock, saveRowPop, archiveFlock, createTask, deleteTask,
  popByTier, setPopByTier,
  popByRow, setPopByRow, tasks, setTasks, weights, setWeights, flocks, setFlocks,
  standards, weather, accounts, me, barnConfig, farmBarns, flagThresh, flagMode }) {
  const cfg = FARMS[farmId];
  const [barn, setBarn] = useState(cfg.barns[0]);
  const [floor, setFloor] = useState(cfg.floors[0]);
  const [cellSel, setCellSel] = useState(null);
  const [tierSel, setTierSel] = useState(null);
  const [tierHov, setTierHov] = useState(null);
  const [range, setRange] = useState(7);
  const [csv, setCsv] = useState(null);
  const [csvPick, setCsvPick] = useState(false);
  const [view, setView] = useState("overview");
  const rLabel = range === 1 ? "24h" : `${range}-day`;
  const rTxt = LANG === "es" ? (range === 1 ? "24 h" : `${range} días`) : rLabel;
  const bc = barnCfg(farmId, barn, barnConfig);
  const th = (flagThresh && flagThresh[farmId]) || FLAG_THRESHOLD;
  const mode = (flagMode && flagMode[farmId]) || "auto";
  const [wForm, setWForm] = useState({ caseW: "", body: "", unif: "" });
  const wData = useMemo(() => weights.filter((w) => w.farm === farmId && w.barn === barn)
    .sort((a, b) => a.ts - b.ts), [weights, farmId, barn]);
  const caseData = wData.filter((w) => w.type === "case").slice(-12);
  const bodyData = wData.filter((w) => w.type === "body").slice(-12);
  const caseOk = parseFloat(wForm.caseW) > 0;
  const bodyOk = parseFloat(wForm.body) > 0 && parseFloat(wForm.unif) > 0
    && parseFloat(wForm.unif) <= 100;
  const logCase = () => {
    addWeight({ farm: farmId, barn, type: "case", caseW: parseFloat(wForm.caseW) });
    setWForm((o) => ({ ...o, caseW: "" }));
  };
  const logBody = () => {
    addWeight({ farm: farmId, barn, type: "body",
      body: parseFloat(wForm.body), unif: parseFloat(wForm.unif) });
    setWForm((o) => ({ ...o, body: "", unif: "" }));
  };
  const flockCsv = () => {
    const mort = saved.filter((e) => e.farm === farmId && e.barn === barn && e.ts >= placed);
    const wr = weights.filter((w) => w.farm === farmId && w.barn === barn);
    const wHead = "date,type,case_lbs,body_lbs,uniformity,logged_by";
    const wLines = wr.map((w) => [new Date(w.ts).toLocaleDateString(), w.type,
      w.caseW != null ? w.caseW : "", w.body != null ? w.body : "",
      w.unif != null ? w.unif : "", w.by].join(","));
    return csvText(mort) + "\n\n" + [wHead, ...wLines].join("\n");
  };
  const [taskText, setTaskText] = useState("");
  const [taskWho, setTaskWho] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const data = useMemo(() => {
    const since = Date.now() - range * 86400000;
    return saved.filter((e) => e.farm === farmId && e.barn === barn && e.floor === floor && e.ts > since);
  }, [saved, farmId, barn, floor, range]);
  const flockKey = `${farmId}-${barn}`;
  const flock = (flocks || {})[flockKey];
  const placed = flock && flock.placedTs ? flock.placedTs : 0;
  const allData = useMemo(() =>
    saved.filter((e) => e.farm === farmId && e.barn === barn && e.floor === floor && e.ts >= placed),
    [saved, farmId, barn, floor, placed]);
  const bData = useMemo(() => {
    const since = Date.now() - range * 86400000;
    return saved.filter((e) => e.farm === farmId && e.barn === barn && e.ts > since);
  }, [saved, farmId, barn, range]);
  const bAll = useMemo(() =>
    saved.filter((e) => e.farm === farmId && e.barn === barn && e.ts >= placed),
    [saved, farmId, barn, placed]);
  const [depopArm, setDepopArm] = useState(false);
  const [repopDate, setRepopDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repopAge, setRepopAge] = useState("17");
  const [repopBreed, setRepopBreed] = useState("");
  const [repopPop, setRepopPop] = useState("");
  const [confirmAsk, setConfirmAsk] = useState(null); // { msg, onYes }
  const [pastFlocks, setPastFlocks] = useState([]);
  useEffect(() => {
    supabase.from("flock_archives").select("id, barn, breed, placed_ts, ended_ts, start_pop, total_deaths, mortality, weights")
      .eq("farm_id", farmId).order("ended_ts", { ascending: false })
      .then(({ data, error }) => { if (!error) setPastFlocks(data || []); });
  }, [farmId, flocks]);
  const popKey = `${farmId}-${barn}-${floor}`;
  const stored = popByTier[popKey] || [];
  const tierPop = Array.from({ length: bc.tiers }, (_, i) =>
    stored[i] != null ? stored[i] : cfg.defaultTierPop);
  const totalPop = tierPop.reduce((a, b) => a + b, 0);
  const storedRow = popByRow[popKey] || [];
  const rowPop = Array.from({ length: bc.rows }, (_, i) =>
    storedRow[i] != null ? storedRow[i] : Math.round(totalPop / bc.rows));
  const setOneRowPop = (i, v) => {
    const next = [...rowPop]; next[i] = Math.max(0, parseInt(v || 0, 10) || 0);
    saveRowPop(popKey, next);
  };
  const rowDeaths = Array.from({ length: bc.rows }, (_, i) =>
    allData.filter((e) => e.row === i + 1).length);
  const cell = (r, s) => data.filter((e) => e.row === r && e.section === s).length;
  const maxCell = Math.max(1, ...Array.from({ length: bc.rows }, (_, i) =>
    Math.max(...SECTIONS.map((s) => cell(i + 1, s)))));
  const expected = data.length / (bc.rows * SECTIONS.length);
  const lim = flagLimit(mode, th, expected);
  const flagged = [];
  bc.floors.forEach((fl) => {
    const dd = bData.filter((e) => e.floor === fl);
    const limF = flagLimit(mode, th, dd.length / (bc.rows * SECTIONS.length));
    for (let r = 1; r <= bc.rows; r++) for (const s of SECTIONS) {
      const nn = dd.filter((e) => e.row === r && e.section === s).length;
      if (nn >= limF) flagged.push({ fl, r, s, n: nn });
    }
  });
  const tierCounts = Array.from({ length: bc.tiers }, (_, i) =>
    data.filter((e) => e.tier === i + 1).length);
  const maxTier = Math.max(1, ...tierCounts);
  const bursts = useMemo(() => {
    const byUser = {};
    bData.forEach((e) => { (byUser[e.user] = byUser[e.user] || []).push(e.ts); });
    const found = [];
    Object.entries(byUser).forEach(([u, tss]) => {
      tss.sort((a, b) => a - b);
      let i = 0;
      for (let j = 0; j < tss.length; j++) {
        while (tss[j] - tss[i] > 180000) i++;
        if (j - i + 1 >= 8) { found.push({ user: u, ts: tss[j], n: j - i + 1 }); break; }
      }
    });
    return found;
  }, [bData]);
  const causeCounts = CAUSES.map((c) => ({ ...c, n: data.filter((e) => e.cause === c.id).length }));
  const startPop = rowPop.reduce((a, b) => a + b, 0);
  const floorRate = startPop ? allData.length / startPop : 0;
  const floorStartOf = (bName, bcX, fl) => {
    const key = `${farmId}-${bName}-${fl}`;
    const tArr = popByTier[key];
    const tSum = tArr ? tArr.reduce((a, x) => a + x, 0) : bcX.tiers * cfg.defaultTierPop;
    const rArr = popByRow[key];
    if (!rArr) return tSum;
    const def = Math.round(tSum / bcX.rows);
    let s = 0;
    for (let i = 0; i < bcX.rows; i++) s += rArr[i] != null ? rArr[i] : def;
    return s;
  };
  const startPopBarn = bc.floors.reduce((a, fl) => a + floorStartOf(barn, bc, fl), 0);
  const barnStats = (bName) => {
    const bcB = barnCfg(farmId, bName, barnConfig);
    const flk = (flocks || {})[`${farmId}-${bName}`];
    const pl = flk && flk.placedTs ? flk.placedTs : 0;
    const since = Date.now() - range * 86400000;
    const dRange = saved.filter((e) => e.farm === farmId && e.barn === bName && e.ts > since);
    const dFlock = saved.filter((e) => e.farm === farmId && e.barn === bName && e.ts >= pl);
    const start = bcB.floors.reduce((a, x) => a + floorStartOf(bName, bcB, x), 0);
    const popNow = Math.max(0, start - dFlock.length);
    const age = flk && flk.placedTs
      ? (parseInt(flk.ageWk, 10) || 0) + Math.floor((Date.now() - flk.placedTs) / 604800000) : null;
    const sd = age != null ? stdAt(stds, age) : null;
    const wk = dFlock.filter((e) => e.ts > Date.now() - 604800000).length;
    const wkR = popNow > 0 ? (wk / popNow) * 100 : null;
    let flags = 0;
    bcB.floors.forEach((flr) => {
      const dd = dRange.filter((e) => e.floor === flr);
      const limF = flagLimit(mode, th, dd.length / (bcB.rows * SECTIONS.length));
      for (let r = 1; r <= bcB.rows; r++) for (const s of SECTIONS)
        if (dd.filter((e) => e.row === r && e.section === s).length >= limF) flags++;
    });
    return { fl: flk, age, dRange, popNow, start, wkR, sd, flags,
      rate: start ? (dRange.length / start) * 100 : 0 };
  };
  const doExportFarm = (k) => {
    const since = Date.now() - range * 86400000;
    const mort = saved.filter((e) => e.farm === farmId && e.ts > since);
    const wr = weights.filter((w) => w.farm === farmId && w.ts > since);
    const base = cfg.name.replace(/\s+/g, "-").toLowerCase();
    const suf = range === 1 ? "24h" : range + "d";
    let text, name;
    if (k === "mort") { text = csvText(mort); name = `${base}-mortality-${suf}.csv`; }
    else if (k === "case") { text = weightsCsv(wr, "case"); name = `${base}-case-weights-${suf}.csv`; }
    else if (k === "body") { text = weightsCsv(wr, "body"); name = `${base}-body-weights-${suf}.csv`; }
    else { text = csvText(mort) + "\n\n" + weightsCsv(wr, "all"); name = `${base}-all-data-${suf}.csv`; }
    setCsvPick(false); setCsv({ text, name });
  };
  const pop = startPopBarn - bAll.length;
  const stds = (standards && standards[farmId] && standards[farmId].length)
    ? standards[farmId] : STD_DEFAULT;
  const ageWk = flock && flock.placedTs
    ? (parseInt(flock.ageWk, 10) || 0) + Math.floor((Date.now() - flock.placedTs) / (7 * 86400000))
    : null;
  const std = ageWk != null ? stdAt(stds, ageWk) : null;
  const wk7 = bAll.filter((e) => e.ts > Date.now() - 7 * 86400000).length;
  const wkRate = pop > 0 ? (wk7 / pop) * 100 : null;
  const rate = startPopBarn ? ((bData.length / startPopBarn) * 100).toFixed(2) : "—";
  const heat = (n) => n === 0 ? C.panel2
    : n >= lim ? C.red
    : `rgba(255,176,32,${0.25 + 0.65 * (n / maxCell)})`;
  const farmUsers = accounts.filter((u) => u.farm === farmId);
  if (view === "overview") return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 26,
          textTransform: "uppercase" }}>{cfg.name}</div>
        {!canEdit && (
          <div style={{ fontFamily: font.mono, fontSize: 12, color: C.mut,
            border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 10px" }}>
            {T("VIEW ONLY — another farm's data", "SOLO LECTURA — datos de otra granja")}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <RangeToggle value={range} onChange={setRange} />
        <button onClick={() => setCsvPick(true)}
          style={{ fontFamily: font.mono, fontSize: 12, padding: "8px 12px", borderRadius: 8,
            background: C.panel2, color: C.text, border: `1px solid ${C.line}`,
            cursor: "pointer" }}>⬇ CSV</button>
      </div>
      <Eyebrow>{T("Every flock at a glance — tap a barn for the full picture", "Cada parvada de un vistazo — toca un galpón para el detalle")}</Eyebrow>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {(farmBarns[farmId] || cfg.barns).map((b) => {
          const s = barnStats(b);
          return (
            <div key={b} onClick={() => { setBarn(b);
                const nf = barnCfg(farmId, b, barnConfig).floors;
                if (!nf.includes(floor)) setFloor(nf[0]);
                setCellSel(null); setTierSel(null); setDepopArm(false); setView("barn"); }}
              style={{ flex: "1 1 240px", minWidth: 220, background: C.panel,
                border: `1px solid ${s.flags ? C.red : C.line}`, borderRadius: 12,
                padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 20,
                  textTransform: "uppercase" }}>{T("Barn", "Galpón")} {b}</div>
                <div style={{ fontSize: 11, color: C.mut }}>
                  {s.fl && s.fl.placedTs
                    ? `${s.age} ${T("wk", "sem")}${s.fl.breed ? " · " + s.fl.breed : ""}`
                    : T("empty — no flock", "vacío — sin parvada")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, margin: "10px 0", fontFamily: font.mono }}>
                <div><div style={{ fontSize: 20, fontWeight: 600, color: s.flags ? C.red : C.amber }}>{s.dRange.length}</div>
                  <div style={{ fontSize: 10, color: C.mut }}>{rTxt} {T("dead", "muertas")}</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 600 }}>{s.rate.toFixed(2)}%</div>
                  <div style={{ fontSize: 10, color: C.mut }}>{T("rate", "tasa")}</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 600, color: C.green }}>{(s.popNow / 1000).toFixed(1)}k</div>
                  <div style={{ fontSize: 10, color: C.mut }}>{T("pop now", "pob. ahora")}</div></div>
              </div>
              <TrendBars data={s.dRange} days={range} wx={weather && weather[farmId]} />
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11,
                fontFamily: font.mono, alignItems: "center" }}>
                {s.sd && s.wkR != null && (
                  <span style={{ color: s.wkR > s.sd.mort * 1.15 ? C.red : C.green }}>
                    {s.wkR > s.sd.mort * 1.15 ? T("▲ above std", "▲ sobre est.") : T("✓ on track", "✓ en meta")}
                  </span>
                )}
                {s.flags > 0 && <span style={{ color: C.red }}>{s.flags} {T("hot spots", "puntos críticos")}</span>}
                <span style={{ flex: 1 }} />
                <span style={{ color: C.mut }}>{T("open →", "abrir →")}</span>
              </div>
            </div>
          );
        })}
      </div>
      <CsvPicker open={csvPick} onPick={doExportFarm} onClose={() => setCsvPick(false)} />
      <CsvModal csv={csv} onClose={() => setCsv(null)} />
    </div>
  );
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 26,
          textTransform: "uppercase" }}>{cfg.name}</div>
        {!canEdit && (
          <div style={{ fontFamily: font.mono, fontSize: 12, color: C.mut,
            border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 10px" }}>
            {T("VIEW ONLY — another farm's data", "SOLO LECTURA — datos de otra granja")}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={() => setView("overview")} style={{ fontFamily: font.mono, fontSize: 13,
          padding: "8px 12px", borderRadius: 8, background: "none",
          border: `1px solid ${C.line}`, color: C.mut, cursor: "pointer" }}>
          ← {T("All barns", "Todos los galpones")}</button>
        {(farmBarns[farmId] || cfg.barns).map((b) => (
          <button key={b} onClick={() => { setBarn(b); setCellSel(null); setTierSel(null);
            setDepopArm(false);
            const nf = barnCfg(farmId, b, barnConfig).floors;
            if (!nf.includes(floor)) setFloor(nf[0]); }} style={{
            fontFamily: font.mono, fontSize: 13, padding: "8px 12px", borderRadius: 8,
            background: barn === b ? C.amber : C.panel2, color: barn === b ? "#15181C" : C.text,
            border: `1px solid ${barn === b ? C.amber : C.line}`, cursor: "pointer" }}>{b}</button>
        ))}
        <div style={{ flex: 1 }} />
        <RangeToggle value={range} onChange={setRange} />
        <button onClick={() => setCsvPick(true)}
          style={{ fontFamily: font.mono, fontSize: 12, padding: "8px 12px", borderRadius: 8,
            background: C.panel2, color: C.text, border: `1px solid ${C.line}`, cursor: "pointer" }}>
          ⬇ CSV
        </button>
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: "12px 16px", marginBottom: 22, display: "flex", gap: 18, flexWrap: "wrap",
        alignItems: "center" }}>
        {flock && flock.placedTs ? (
          <>
            <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontSize: 15,
              letterSpacing: "0.08em" }}>
              {T("Flock", "Parvada")} — <span style={{ color: C.amber }}>{ageWk} {T("wks old", "semanas")}</span>
              <span style={{ color: C.mut, fontFamily: font.body, fontSize: 12,
                textTransform: "none", letterSpacing: 0 }}>{flock.breed ? ` · ${flock.breed}` : ""} · {T("placed", "alojada")} {new Date(flock.placedTs).toLocaleDateString()} {T("at", "a las")} {flock.ageWk} {T("wks", "sem")}</span>
            </div>
            {std && (
              <div style={{ fontFamily: font.mono, fontSize: 12, color: C.mut }}>
                {T("Weekly mort", "Mort. semanal")} {wkRate == null ? "—" : wkRate.toFixed(2) + "%"} · {T("std", "est.")} {std.mort.toFixed(2)}%
                <span style={{ marginLeft: 6,
                  color: wkRate != null && wkRate > std.mort * 1.15 ? C.red : C.green }}>
                  {wkRate == null ? "" : wkRate > std.mort * 1.15 ? T("▲ above standard", "▲ sobre el estándar") : T("✓ on track", "✓ en meta")}
                </span>
              </div>
            )}
            <div style={{ flex: 1 }} />
            {canEdit && (depopArm ? (
              <>
                <span style={{ fontSize: 12, color: C.red }}>
                  {T("Depopulate barn", "¿Despoblar galpón")} {barn}? {T("The whole flock (mortality, weights, dates) is archived first — view it later under Past flocks.", "La parvada completa (mortalidad, pesos, fechas) se archiva primero — revísala luego en Parvadas anteriores.")}</span>
                <button onClick={() => setCsv({ text: flockCsv(),
                    name: `${cfg.name.replace(/\s+/g, "-").toLowerCase()}-barn-${barn}-flock.csv` })}
                  style={smallBtn()}>{T("⬇ Export flock CSV", "⬇ Exportar CSV de la parvada")}</button>
                <button onClick={() => { archiveFlock(farmId, barn); setDepopArm(false); }}
                  style={smallBtn(C.red)}>{T("Yes, archive & depopulate", "Sí, archivar y despoblar")}</button>
                <button onClick={() => setDepopArm(false)} style={smallBtn()}>{T("Cancel", "Cancelar")}</button>
              </>
            ) : (
              <button onClick={() => setDepopArm(true)} style={smallBtn()}>{T("Depopulate…", "Despoblar…")}</button>
            ))}
          </>
        ) : (
          <>
            <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontSize: 15,
              letterSpacing: "0.08em", color: C.mut }}>{T("Barn", "Galpón")} {barn} — {T("empty, no flock", "vacío, sin parvada")}</div>
            {canEdit && (
              <>
                <label style={{ fontSize: 12, color: C.mut }}>{T("Placed", "Alojada")}
                  <input type="date" value={repopDate} onChange={(e) => setRepopDate(e.target.value)}
                    style={{ ...inputStyle, padding: "8px", marginLeft: 6 }} />
                </label>
                <label style={{ fontSize: 12, color: C.mut }}>{T("Age at placement (wks)", "Edad al alojar (sem)")}
                  <input type="number" value={repopAge} onChange={(e) => setRepopAge(e.target.value)}
                    style={{ ...inputStyle, width: 64, padding: "8px", marginLeft: 6,
                      fontFamily: font.mono, textAlign: "right" }} />
                </label>
                <label style={{ fontSize: 12, color: C.mut }}>{T("Breed", "Estirpe")}
                  <input value={repopBreed} onChange={(e) => setRepopBreed(e.target.value)}
                    placeholder={T("e.g. Hy-Line Brown", "ej. Hy-Line Brown")}
                    style={{ ...inputStyle, width: 170, padding: "8px", marginLeft: 6,
                      borderColor: repopBreed.trim() ? C.line : C.amberDim }} />
                </label>
                <label style={{ fontSize: 12, color: C.mut }}>{T("Birds placed", "Aves alojadas")}
                  <input type="number" inputMode="numeric" value={repopPop}
                    onChange={(e) => setRepopPop(e.target.value.replace(/\D/g, ""))}
                    placeholder={T("total", "total")}
                    style={{ ...inputStyle, width: 90, padding: "8px", marginLeft: 6,
                      fontFamily: font.mono, textAlign: "right",
                      borderColor: parseInt(repopPop, 10) > 0 ? C.line : C.amberDim }} />
                </label>
                <button disabled={!repopBreed.trim() || !(parseInt(repopPop, 10) > 0)}
                  onClick={() => {
                    const startPop = parseInt(repopPop, 10);
                    updateFlock(flockKey,
                      { placedTs: new Date(repopDate + "T12:00:00").getTime() || Date.now(),
                        ageWk: parseInt(repopAge, 10) || 17, breed: repopBreed.trim(),
                        startPop });
                    // Spread the placed birds evenly across floors and rows as a
                    // starting point — managers refine per-row counts after.
                    const perFloor = Math.round(startPop / bc.floors.length);
                    bc.floors.forEach((fl) => {
                      const per = Math.round(perFloor / bc.rows);
                      saveRowPop(`${farmId}-${barn}-${fl}`,
                        Array.from({ length: bc.rows }, () => per));
                    });
                    setRepopBreed(""); setRepopPop(""); }}
                  style={{ ...smallBtn(repopBreed.trim() && parseInt(repopPop, 10) > 0 ? C.green : null),
                    color: repopBreed.trim() && parseInt(repopPop, 10) > 0 ? "#15181C" : C.dis,
                    cursor: repopBreed.trim() && parseInt(repopPop, 10) > 0 ? "pointer" : "default" }}>{T("Repopulate", "Repoblar")}</button>
              </>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        {[[LANG === "es" ? `Mortalidad ${range === 1 ? "24 h" : range + " días"}` : `${rLabel} mortality`, bData.length],
          [T("Est. population", "Población est."), pop.toLocaleString()],
          [LANG === "es" ? `Tasa ${range === 1 ? "24 h" : range + " días"}` : `${rLabel} rate`, rate + "%"],
          [T("Flagged cells", "Celdas marcadas"), flagged.length]].map(([k, v], i) => (
          <div key={k} style={{ background: C.panel, border: `1px solid ${i === 3 && flagged.length ? C.red : C.line}`,
            borderRadius: 12, padding: "12px 18px", minWidth: 150 }}>
            <div style={{ fontSize: 12, color: C.mut }}>{k}</div>
            <div style={{ fontFamily: font.mono, fontSize: 26, fontWeight: 600,
              color: i === 3 && flagged.length ? C.red : C.text }}>{v}</div>
          </div>
        ))}
      </div>
      {flock && flock.startPop != null && startPopBarn !== flock.startPop && (
        <div style={{ background: "rgba(255,176,32,0.08)", border: `1px solid ${C.amberDim}`,
          borderRadius: 12, padding: "10px 14px", marginBottom: 22, fontSize: 13 }}>
          <span style={{ color: C.amber, fontWeight: 600 }}>
            {T("Population mismatch:", "Discrepancia de población:")}</span>{" "}
          {T("row counts total", "las filas suman")} {startPopBarn.toLocaleString()}{" "}
          {T("but", "pero")} {flock.startPop.toLocaleString()}{" "}
          {T("birds were placed. Adjust the per-row counts below until they match.",
             "aves fueron alojadas. Ajusta los conteos por fila hasta que coincidan.")}
        </div>
      )}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: 14, marginBottom: 22 }}>
        <Eyebrow>{T("Trend — barn", "Tendencia — galpón")} {barn} ({T("whole flock, all floors", "toda la parvada, todos los pisos")}) · {range === 1 ? T("hourly, last 24 h", "por hora, últimas 24 h") : LANG === "es" ? `diaria, últimos ${range} días` : `daily, last ${range} days`}</Eyebrow>
        <TrendBars data={bData} days={range} wx={weather && weather[farmId]} />
        {range !== 1 && (
          <div style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>
            {T("Strip under bars = daily high temp:", "Franja bajo las barras = máxima diaria:")} <span style={{ color: C.amber }}>■</span> 88°F+
            <span style={{ color: C.red }}> ■</span> 95°F+ · {T("hover a bar for the weather that day", "pasa el cursor por una barra para ver el clima de ese día")}
          </div>
        )}
      </div>
      {bursts.length > 0 && (
        <div style={{ background: "rgba(255,176,32,0.08)", border: `1px solid ${C.amberDim}`,
          borderRadius: 12, padding: 14, marginBottom: 22 }}>
          <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontWeight: 700,
            color: C.amber, letterSpacing: "0.1em", marginBottom: 6 }}>{T("Data quality — possible batch entry", "Calidad de datos — posible captura en lote")}</div>
          {bursts.map((b) => (
            <div key={b.user + b.ts} style={{ fontFamily: font.mono, fontSize: 14 }}>
              {b.user} {T("logged", "registró")} {b.n} {T("birds in under 3 min on", "aves en menos de 3 min el")} {new Date(b.ts).toLocaleDateString()} — {T("locations may not be reliable", "las ubicaciones pueden no ser confiables")}
            </div>
          ))}
        </div>
      )}
      {flagged.length > 0 && (
        <div style={{ background: "rgba(255,90,72,0.1)", border: `1px solid ${C.red}`,
          borderRadius: 12, padding: 14, marginBottom: 22 }}>
          <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontWeight: 700,
            color: C.red, letterSpacing: "0.1em", marginBottom: 6 }}>{T("Hot spots — check equipment", "Puntos críticos — revisar equipo")}</div>
          {flagged.map((f) => (
            <div key={f.r + f.s} style={{ fontFamily: font.mono, fontSize: 14 }}>
              {floorT(f.fl)} · {T("Row", "Fila")} {f.r} · {secT(f.s)} — {f.n} {T("birds", "aves")} · {rTxt}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 420px" }}>
          {bc.floors.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.mut }}>{T("Floor:", "Piso:")}</span>
              {bc.floors.map((f) => (
                <button key={f} onClick={() => { setFloor(f); setCellSel(null); setTierSel(null); }} style={{
                  fontFamily: font.mono, fontSize: 13, padding: "8px 14px", borderRadius: 8,
                  background: floor === f ? C.amber : C.panel2, color: floor === f ? "#15181C" : C.text,
                  border: `1px solid ${floor === f ? C.amber : C.line}`, cursor: "pointer" }}>{floorT(f)}</button>
              ))}
              <span style={{ fontFamily: font.mono, fontSize: 12, color: C.mut, marginLeft: 8 }}>
                {data.length} {T("dead", "muertas")} ({rTxt}) · {T("pop", "pob.")} {startPop.toLocaleString()} <span style={{ color: C.green }}>→ {(startPop - allData.length).toLocaleString()}</span>
              </span>
            </div>
          )}
          <Eyebrow>{T("Row × section heatmap", "Mapa de calor fila × sección")} ({rTxt}) — {T("Row 1 at bottom · red =", "Fila 1 abajo · rojo =")} {lim}+ {T("birds", "aves")}{mode === "auto" ? " (auto)" : ""} · {T("tap a cell to see tiers", "toca una celda para ver niveles")}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: `60px repeat(3, 1fr) 186px`, gap: 6 }}>
            <div />
            {SECTIONS.map((s) => <div key={s} style={{ fontSize: 12, color: C.mut, textAlign: "center" }}>{secT(s)}</div>)}
            <div style={{ fontSize: 12, color: C.mut, textAlign: "right" }}>{T("Pop start → now · %", "Pob. inicio → ahora · %")}</div>
            {Array.from({ length: bc.rows }, (_, i) => bc.rows - i).map((r) => (
              [<div key={"l" + r} style={{ fontFamily: font.mono, fontSize: 13, color: C.mut,
                display: "flex", alignItems: "center" }}>{T("Row", "Fila")} {r}</div>,
              ...SECTIONS.map((s) => {
                const n = cell(r, s);
                const sel = cellSel && cellSel.r === r && cellSel.s === s;
                return <button key={r + s} onClick={() => { setCellSel(sel ? null : { r, s }); setTierSel(null); }}
                  style={{ background: heat(n), borderRadius: 8, cursor: "pointer",
                  minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: font.mono, fontSize: 15, fontWeight: 600,
                  color: n >= lim ? "#fff" : n ? "#15181C" : C.faint,
                  border: `2px solid ${sel ? C.text : C.line}` }}>{n || ""}</button>;
              }),
              <div key={"pop" + r} style={{ display: "flex", alignItems: "center", gap: 4,
                justifyContent: "flex-end" }}>
                {canEdit ? (
                  <input type="number" value={rowPop[r - 1]}
                    onChange={(ev) => setOneRowPop(r - 1, ev.target.value)}
                    style={{ width: 54, background: C.panel2, border: `1px solid ${C.line}`,
                      borderRadius: 6, color: C.text, fontFamily: font.mono, fontSize: 12,
                      padding: "4px 4px", textAlign: "right" }} />
                ) : (
                  <span style={{ fontFamily: font.mono, fontSize: 12, color: C.mut }}>
                    {rowPop[r - 1].toLocaleString()}</span>
                )}
                <span style={{ color: C.mut, fontSize: 11 }}>→</span>
                <span style={{ fontFamily: font.mono, fontSize: 13, color: C.green }}>
                  {Math.max(0, rowPop[r - 1] - rowDeaths[r - 1]).toLocaleString()}</span>
                {(() => {
                  const rr = rowPop[r - 1] ? rowDeaths[r - 1] / rowPop[r - 1] : 0;
                  const hot = rowDeaths[r - 1] >= 3 && rr > floorRate * 1.5;
                  return <span title={hot ? T("Above normal for this floor", "Arriba de lo normal para este piso") : ""}
                    style={{ fontFamily: font.mono, fontSize: 12, width: 50,
                      textAlign: "right", color: hot ? C.red : C.mut,
                      fontWeight: hot ? 700 : 400 }}>{(rr * 100).toFixed(2)}%</span>;
                })()}
              </div>,
              ...(r % 2 === 1 && r !== 1 ? [<div key={"aisle" + r} title={T("Walk aisle", "Pasillo")}
                style={{ gridColumn: "1 / -1", height: 4, background: C.line,
                  borderRadius: 2, margin: "3px 0", opacity: 0.8 }} />] : [])]
            ))}
          </div>
          {cellSel && (() => {
            const cd = data.filter((e) => e.row === cellSel.r && e.section === cellSel.s);
            const ct = Array.from({ length: bc.tiers }, (_, i) =>
              cd.filter((e) => e.tier === i + 1).length);
            const mx = Math.max(1, ...ct);
            const causeSrc = tierSel ? cd.filter((e) => e.tier === tierSel) : cd;
            return (
              <div style={{ marginTop: 16, background: C.panel, border: `1px solid ${C.amber}`,
                borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 20,
                    textTransform: "uppercase" }}>
                    {T("Row", "Fila")} {cellSel.r} · {secT(cellSel.s)} — {cd.length} {T("birds", "aves")} · {T("tap a tier for causes", "toca un nivel para ver causas")}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => { setCellSel(null); setTierSel(null); }} style={{ background: "none",
                    border: `1px solid ${C.line}`, color: C.mut, borderRadius: 6,
                    padding: "3px 10px", cursor: "pointer" }}>✕</button>
                </div>
                {Array.from({ length: bc.tiers }, (_, i) => bc.tiers - i).map((t) => {
                  const on = tierSel === t;
                  return (
                    <button key={t} onClick={() => setTierSel(on ? null : t)}
                      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5,
                        width: "100%", background: on ? "rgba(255,176,32,0.12)" : "none",
                        border: `1px solid ${on ? C.amber : "transparent"}`, borderRadius: 8,
                        padding: "4px 6px", cursor: "pointer" }}>
                      <div style={{ fontFamily: font.mono, fontSize: 13,
                        color: on ? C.amber : C.mut, width: 26, textAlign: "left" }}>T{t}</div>
                      <div style={{ flex: 1, background: C.panel2, borderRadius: 6, height: 22, overflow: "hidden" }}>
                        <div style={{ width: `${(ct[t - 1] / mx) * 100}%`, height: "100%",
                          background: ct[t - 1] ? C.amber : "transparent", borderRadius: 6 }} />
                      </div>
                      <div style={{ fontFamily: font.mono, fontSize: 13, width: 26,
                        textAlign: "right", color: C.text }}>{ct[t - 1]}</div>
                    </button>
                  );
                })}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontSize: 13,
                    letterSpacing: "0.12em", color: tierSel ? C.amber : C.mut, marginBottom: 6 }}>
                    {tierSel ? (LANG === "es" ? `Nivel ${tierSel} — causas` : `Tier ${tierSel} — why they died`) : T("All tiers — why they died", "Todos los niveles — causas")}
                  </div>
                  {causeSrc.length === 0 && (
                    <div style={{ fontSize: 13, color: C.mut }}>{T("No birds on this tier in this spot.", "No hay aves en este nivel en este punto.")}</div>
                  )}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {CAUSES.map((c) => {
                      const n = causeSrc.filter((e) => e.cause === c.id).length;
                      return n ? <div key={c.id} style={{ fontFamily: font.mono, fontSize: 14,
                        color: C.mut }}>{causeT(c)}: <span style={{ color: C.text }}>{n}</span>
                        <span style={{ fontSize: 12 }}> ({Math.round((n / causeSrc.length) * 100)}%)</span></div> : null;
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ flex: "1 1 320px" }}>
          <Eyebrow>{T("By tier", "Por nivel")} ({bc.tiers} = {T("top", "arriba")}) — {floorT(floor)} · {T("deaths · % of deaths", "muertes · % de muertes")}</Eyebrow>
          {Array.from({ length: bc.tiers }, (_, i) => bc.tiers - i).map((t) => {
            const n = tierCounts[t - 1];
            return (
              <div key={t} onMouseEnter={() => setTierHov(t)} onMouseLeave={() => setTierHov(null)}
                onTouchStart={() => setTierHov(t)}
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 8,
                  marginBottom: 6, cursor: "pointer" }}>
                {tierHov === t && (
                  <div style={{ position: "absolute", bottom: "100%", left: 30, marginBottom: 4,
                    background: C.panel2, border: `1px solid ${C.amber}`, color: C.text,
                    fontFamily: font.mono, fontSize: 11, padding: "4px 8px", borderRadius: 6,
                    whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5 }}>
                    {CAUSES.map((c) => {
                      const k = data.filter((e) => e.tier === t && e.cause === c.id).length;
                      return k ? `${causeT(c)} ${k}` : null;
                    }).filter(Boolean).join(" · ") || T("no deaths this period", "sin muertes en este periodo")}
                  </div>
                )}
                <div style={{ fontFamily: font.mono, fontSize: 13, color: C.mut, width: 26 }}>T{t}</div>
                <div style={{ flex: 1, background: C.panel2, borderRadius: 6, height: 30, overflow: "hidden" }}>
                  <div style={{ width: `${(n / maxTier) * 100}%`, height: "100%",
                    background: C.amber, borderRadius: 6 }} />
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 13, width: 30, textAlign: "right" }}>{n}</div>
                <div style={{ fontFamily: font.mono, fontSize: 12, width: 44, textAlign: "right",
                  color: C.mut }}>{data.length ? Math.round((n / data.length) * 100) : 0}%</div>
              </div>
            );
          })}
          {canEdit && (
            <div style={{ fontSize: 12, color: C.mut, marginTop: 4 }}>
              {T("Starting populations are edited at the row ends on the heatmap — the floor total follows them.", "Las poblaciones iniciales se editan al final de cada fila del mapa — el total del piso las sigue.")}
            </div>
          )}
          <div style={{ height: 20 }} />
          <Eyebrow>{T("By cause", "Por causa")} — {floorT(floor)} · {T("count · share of deaths", "número · % de muertes")}</Eyebrow>
          {causeCounts.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between",
              fontFamily: font.mono, fontSize: 14, padding: "6px 0",
              borderBottom: `1px solid ${C.line}` }}>
              <span style={{ color: C.mut }}>{causeT(c)}</span>
              <span>{c.n}
                <span style={{ color: C.mut, fontSize: 12, marginLeft: 10,
                  display: "inline-block", width: 38, textAlign: "right" }}>
                  {data.length ? Math.round((c.n / data.length) * 100) : 0}%</span></span>
            </div>
          ))}
        </div>
      </div>
      {/* weekly weights */}
      <div style={{ marginTop: 28 }}>
        <Eyebrow>{T("Weekly weights — barn", "Pesos semanales — galpón")} {barn} · {T("case weights, body weight & uniformity from the scale", "peso de cajas, peso corporal y uniformidad de la báscula")}</Eyebrow>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          {canEdit && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap",
                background: C.panel2, borderRadius: 10, padding: "10px 14px" }}>
                <label style={{ fontSize: 12, color: C.mut, display: "grid", gap: 4 }}>{T("Case weight (lbs)", "Peso de caja (lbs)")}
                  <input type="number" step="0.1" inputMode="decimal" value={wForm.caseW}
                    onChange={(e) => setWForm((o) => ({ ...o, caseW: e.target.value }))}
                    style={{ ...inputStyle, width: 108, fontFamily: font.mono }} />
                </label>
                <button disabled={!caseOk} onClick={logCase}
                  style={{ background: caseOk ? C.amber : C.panel, color: caseOk ? "#15181C" : C.dis,
                    fontWeight: 600, border: `1px solid ${caseOk ? C.amber : C.line}`, borderRadius: 8,
                    padding: "12px 18px", fontSize: 14, cursor: caseOk ? "pointer" : "default" }}>
                  {T("Log case", "Registrar caja")}
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap",
                background: C.panel2, borderRadius: 10, padding: "10px 14px" }}>
                <label style={{ fontSize: 12, color: C.mut, display: "grid", gap: 4 }}>{T("Avg body wt (lbs)", "Peso corporal prom. (lbs)")}
                  <input type="number" step="0.01" inputMode="decimal" value={wForm.body}
                    onChange={(e) => setWForm((o) => ({ ...o, body: e.target.value }))}
                    style={{ ...inputStyle, width: 108, fontFamily: font.mono }} />
                </label>
                <label style={{ fontSize: 12, color: C.mut, display: "grid", gap: 4 }}>{T("Uniformity (%) — required", "Uniformidad (%) — requerida")}
                  <input type="number" step="1" inputMode="decimal" value={wForm.unif}
                    onChange={(e) => setWForm((o) => ({ ...o, unif: e.target.value }))}
                    style={{ ...inputStyle, width: 130, fontFamily: font.mono,
                      borderColor: wForm.body && !wForm.unif ? C.red : C.line }} />
                </label>
                <button disabled={!bodyOk} onClick={logBody}
                  style={{ background: bodyOk ? C.amber : C.panel, color: bodyOk ? "#15181C" : C.dis,
                    fontWeight: 600, border: `1px solid ${bodyOk ? C.amber : C.line}`, borderRadius: 8,
                    padding: "12px 18px", fontSize: 14, cursor: bodyOk ? "pointer" : "default" }}>
                  {T("Log body wt", "Registrar peso")}
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <WeightChart title={T("Case weight", "Peso de caja")} unit=" lbs" std={std ? std.caseW : null}
              points={caseData.map((w) => ({ ts: w.ts, v: w.caseW }))} />
            <WeightChart title={T("Avg body weight", "Peso corporal prom.")} unit=" lbs" decimals={2} std={std ? std.body : null}
              points={bodyData.map((w) => ({ ts: w.ts, v: w.body }))} />
            <WeightChart title={T("Uniformity", "Uniformidad")} unit="%" decimals={0} std={std ? std.unif : null}
              points={bodyData.map((w) => ({ ts: w.ts, v: w.unif }))} />
          </div>
          <div style={{ fontSize: 12, color: C.mut, marginTop: 12 }}>
            {T("Case weights and body-weight checks log separately — hover a bar for date and value. Dashed line = standard at this flock's age.", "Las cajas y los pesos corporales se registran por separado — pasa el cursor para ver fecha y valor. Línea punteada = estándar a la edad de la parvada.")}
          </div>
          {wData.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Eyebrow>{T("Recent entries", "Registros recientes")}</Eyebrow>
              <div style={{ display: "grid", gap: 6 }}>
                {wData.slice(-8).reverse().map((w) => (
                  <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12,
                    background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
                    padding: "8px 12px", fontFamily: font.mono, fontSize: 13,
                    flexWrap: "wrap" }}>
                    <span style={{ color: C.mut, minWidth: 130 }}>
                      {new Date(w.ts).toLocaleDateString([], { month: "short", day: "numeric" })}
                      {" · "}
                      {new Date(w.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    <span style={{ flex: 1, minWidth: 140 }}>
                      {w.type === "case"
                        ? `${T("Case", "Caja")} ${w.caseW} lbs`
                        : `${T("Body", "Corporal")} ${w.body} lbs · ${w.unif}%`}</span>
                    <span style={{ color: C.mut }}>{w.by}</span>
                    {canEdit && (
                      <button onClick={() => setConfirmAsk({
                          msg: `${T("Delete this weight entry?", "¿Borrar este registro de peso?")} (${new Date(w.ts).toLocaleDateString()} · ${w.by})`,
                          onYes: () => deleteWeight(w.id) })}
                        title={T("Delete this entry", "Eliminar este registro")}
                        style={{ background: "none", border: `1px solid ${C.line}`, color: C.red,
                          borderRadius: 6, padding: "4px 10px", fontSize: 14,
                          cursor: "pointer" }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* tasks */}
      <div style={{ marginTop: 28 }}>
        <Eyebrow>{T("Tasks — barn", "Tareas — galpón")} {barn}</Eyebrow>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <input value={taskText} onChange={(e) => setTaskText(e.target.value)}
                placeholder={T("e.g. Clean out under the system", "ej. Limpiar debajo del sistema")}
                style={{ ...inputStyle, flex: "2 1 240px" }} />
              <select value={taskWho} onChange={(e) => setTaskWho(e.target.value)}
                style={{ ...inputStyle, flex: "1 1 130px", padding: "12px 8px" }}>
                <option value="">{T("Anyone in barn", "Cualquiera del galpón")}</option>
                {farmUsers.filter((w) => w.role === "worker").map((w) => (
                  <option key={w.name} value={w.name}>{w.name}</option>
                ))}
              </select>
              <input value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
                placeholder={T("Due (e.g. Fri 2pm)", "Entrega (ej. vie 2pm)")} style={{ ...inputStyle, flex: "1 1 120px" }} />
              <button disabled={!taskText.trim()} onClick={() => {
                createTask({ farm: farmId, barn, floor, text: taskText.trim(),
                  assignedTo: taskWho || null, due: taskDue.trim() || null });
                setTaskText(""); setTaskWho(""); setTaskDue("");
              }} style={{ background: taskText.trim() ? C.amber : C.panel2,
                color: taskText.trim() ? "#15181C" : C.dis, fontWeight: 600,
                border: `1px solid ${taskText.trim() ? C.amber : C.line}`, borderRadius: 8,
                padding: "12px 20px", fontSize: 14, cursor: taskText.trim() ? "pointer" : "default" }}>
                {T("Assign", "Asignar")}
              </button>
            </div>
          )}
          {tasks.filter((t) => t.farm === farmId && t.barn === barn).length === 0 && (
            <div style={{ fontSize: 13, color: C.mut }}>{T("No tasks for this barn yet.", "Aún no hay tareas para este galpón.")}</div>
          )}
          {tasks.filter((t) => t.farm === farmId && t.barn === barn).map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "8px 0", borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
              <span style={{ fontFamily: font.mono, fontSize: 12,
                color: t.status === "open" ? C.amber : C.green, width: 46 }}>
                {t.status === "open" ? T("OPEN", "ABIERTA") : T("DONE", "HECHA")}</span>
              <span style={{ fontFamily: font.mono, fontSize: 11, color: C.mut }}>{floorT(t.floor)}</span>
              <span style={{ flex: 1, color: t.status === "done" ? C.mut : C.text,
                textDecoration: t.status === "done" ? "line-through" : "none" }}>
                {t.text}{t.due && <span style={{ color: C.mut }}> · {t.due}</span>}</span>
              <span style={{ fontSize: 12, color: C.mut }}>
                {t.status === "done" ? T("by ", "por ") + t.doneBy : (t.assignedTo || T("Anyone", "Cualquiera"))}</span>
              {canEdit && (
                <button onClick={() => setConfirmAsk({
                    msg: `${T("Delete this task?", "¿Borrar esta tarea?")} "${t.text}"`,
                    onYes: () => deleteTask(t.id) })}
                  style={{ background: "none", border: `1px solid ${C.line}`, color: C.mut,
                    borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{"✕"}</button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* recent entries */}
      <div style={{ marginTop: 28 }}>
        <Eyebrow>{T("Recent entries — who logged what", "Registros recientes — quién registró qué")}{canEdit ? T(" · ✕ removes a mistaken entry", " · ✕ borra un registro erróneo") : ""}</Eyebrow>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          maxHeight: 220, overflowY: "auto" }}>
          {[...bData].sort((a, b) => b.ts - a.ts).slice(0, 30).map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14,
              fontFamily: font.mono, fontSize: 13,
              padding: "6px 14px", borderBottom: `1px solid ${C.line}`, color: C.mut }}>
              <span style={{ width: 90 }}>{new Date(e.ts).toLocaleDateString()}</span>
              <span style={{ width: 70, color: C.text }}>{e.user}</span>
              <span>{e.floor[0]}·R{e.row} · {secT(e.section)[0]} · T{e.tier}</span>
              <span style={{ flex: 1, textAlign: "right" }}>{causeT(CAUSES.find((c) => c.id === e.cause))}</span>
              {canEdit && (
                <button onClick={() => setConfirmAsk({
                    msg: `${T("Delete this mortality entry?", "¿Borrar este registro de mortalidad?")} (${new Date(e.ts).toLocaleDateString()} · ${e.user})`,
                    onYes: () => deleteEntry(e.id) })}
                  style={{ background: "none", border: `1px solid ${C.line}`, color: C.mut,
                    borderRadius: 6, padding: "3px 9px", fontSize: 12, cursor: "pointer" }}>{"✕"}</button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* ---- Past flocks (archived at depopulation) ---- */}
      {pastFlocks.filter((a) => a.barn === barn).length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: 14, marginBottom: 22 }}>
          <Eyebrow>{T("Past flocks — barn", "Parvadas anteriores — galpón")} {barn}</Eyebrow>
          {pastFlocks.filter((a) => a.barn === barn).map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14,
              flexWrap: "wrap", fontFamily: font.mono, fontSize: 13,
              padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
              <span style={{ color: C.text }}>{a.breed || T("(no breed)", "(sin estirpe)")}</span>
              <span style={{ color: C.mut }}>
                {a.placed_ts ? new Date(a.placed_ts).toLocaleDateString() : "—"} → {new Date(a.ended_ts).toLocaleDateString()}
              </span>
              {a.start_pop != null && <span style={{ color: C.mut }}>
                {a.start_pop.toLocaleString()} {T("placed", "alojadas")}</span>}
              <span style={{ color: C.red }}>{a.total_deaths.toLocaleString()} {T("dead", "muertas")}</span>
              {a.start_pop > 0 && <span style={{ color: C.mut }}>
                ({((a.total_deaths / a.start_pop) * 100).toFixed(2)}%)</span>}
              <span style={{ flex: 1 }} />
              <button onClick={() => setCsv({
                  text: csvText(a.mortality || []) + "\n\n" + weightsCsv(a.weights || [], "all"),
                  name: `${cfg.name.replace(/\s+/g, "-").toLowerCase()}-barn-${barn}-flock-${new Date(a.ended_ts).toISOString().slice(0, 10)}.csv` })}
                style={smallBtn()}>{T("⬇ CSV", "⬇ CSV")}</button>
            </div>
          ))}
        </div>
      )}
      {confirmAsk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 80,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 26, maxWidth: 420, width: "100%" }}>
            <div style={{ fontFamily: font.disp, fontSize: 22, fontWeight: 700,
              textTransform: "uppercase", marginBottom: 8 }}>{T("Are you sure?", "¿Estás seguro?")}</div>
            <div style={{ color: C.mut, fontSize: 14, marginBottom: 18 }}>{confirmAsk.msg}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmAsk(null)}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text,
                  borderRadius: 8, padding: "12px 20px", fontSize: 14, cursor: "pointer" }}>
                {T("Cancel", "Cancelar")}</button>
              <button onClick={() => { const fn = confirmAsk.onYes; setConfirmAsk(null); fn(); }}
                style={{ background: C.red, border: `1px solid ${C.red}`, color: "#fff",
                  fontWeight: 600, borderRadius: 8, padding: "12px 20px", fontSize: 14,
                  cursor: "pointer" }}>{T("Delete", "Borrar")}</button>
            </div>
          </div>
        </div>
      )}
      <CsvPicker open={csvPick} onPick={doExportFarm} onClose={() => setCsvPick(false)} />
      <CsvModal csv={csv} onClose={() => setCsv(null)} />
    </div>
  );
}
/* ================= SETTINGS (accounts + barn layout) ================= */
function SettingsView({ farmId, barnConfig, setBarnConfig, farmBarns, setFarmBarns,
  accounts, setAccounts, reloadAccounts, saved, me, flagThresh, setFlagThresh, flagMode, setFlagMode,
  standards, setStandards }) {
  const stds = (standards && standards[farmId] && standards[farmId].length)
    ? standards[farmId] : STD_DEFAULT;
  const setStd = (i, k, v) => setStandards((m) => {
    const cur = ((m && m[farmId] && m[farmId].length) ? m[farmId] : STD_DEFAULT)
      .map((r) => ({ ...r }));
    cur[i][k] = v;
    return { ...m, [farmId]: cur };
  });
  const cfg = FARMS[farmId];
  const barns = farmBarns[farmId] || cfg.barns;
  const [selBarn, setSelBarn] = useState(barns[0]);
  const [newBarn, setNewBarn] = useState("");
  const [newName, setNewName] = useState("");
  const [newManager, setNewManager] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [mgBusy, setMgBusy] = useState(null); // user_id currently being changed
  const [confirmRemove, setConfirmRemove] = useState(null); // account pending removal confirm
  const [inactive, setInactive] = useState([]); // deactivated accounts for this farm
  useEffect(() => {
    supabase.from("profiles").select("id, name, role").eq("farm_id", farmId).eq("active", false)
      .then(({ data, error }) => { if (!error) setInactive(data || []); });
  }, [farmId, accounts]);
  const manageAccount = async (userId, action, role) => {
    setMgBusy(userId); setAddErr("");
    const { data, error } = await supabase.functions.invoke("manage-account", {
      body: { action, user_id: userId, role },
    });
    setMgBusy(null);
    if (error) {
      let msg = error.message || String(error);
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          if (body && body.error) msg = body.error;
        }
      } catch {}
      setAddErr(msg);
      return;
    }
    if (data && data.mode === "deactivated") {
      setAddErr(T("Account had logged entries, so it was deactivated (hidden from sign-in) instead of deleted.",
        "La cuenta tenía registros, así que se desactivó (oculta del inicio de sesión) en lugar de borrarse."));
    }
    if (reloadAccounts) await reloadAccounts();
  };
  const bc = barnCfg(farmId, selBarn, barnConfig);
  const [rowsDraft, setRowsDraft] = useState(String(bc.rows));
  const [tiersDraft, setTiersDraft] = useState(String(bc.tiers));
  const [floorsDraft, setFloorsDraft] = useState(String(bc.floors.length));
  const [newFloors, setNewFloors] = useState(String(cfg.floors.length));
  const th = (flagThresh && flagThresh[farmId]) || FLAG_THRESHOLD;
  const mode = (flagMode && flagMode[farmId]) || "auto";
  const [threshDraft, setThreshDraft] = useState(String(th));
  useEffect(() => { setRowsDraft(String(bc.rows)); setTiersDraft(String(bc.tiers));
    setFloorsDraft(String(bc.floors.length)); }, [selBarn]); // eslint-disable-line
  const farmUsers = accounts.filter((u) => u.farm === farmId);
  const barnEntryCount = (b) => saved.filter((e) => e.farm === farmId && e.barn === b).length;
  const commitBC = (field, raw, lo, hi, setDraft) => {
    const v = Math.max(lo, Math.min(hi, parseInt(raw, 10) || lo));
    setDraft(String(v));
    setBarnConfig((o) => ({ ...o,
      [`${farmId}-${selBarn}`]: { ...(o[`${farmId}-${selBarn}`] || {}), [field]: v } }));
  };
  const onEnterBlur = (e) => { if (e.key === "Enter") e.target.blur(); };
  const commitFloors = () => {
    const v = Math.max(1, Math.min(3, parseInt(floorsDraft, 10) || 1));
    setFloorsDraft(String(v));
    setBarnConfig((o) => ({ ...o,
      [`${farmId}-${selBarn}`]: { ...(o[`${farmId}-${selBarn}`] || {}), floors: floorLabels(v) } }));
  };
  const commitThresh = () => {
    const v = Math.max(2, Math.min(50, parseInt(threshDraft, 10) || FLAG_THRESHOLD));
    setThreshDraft(String(v));
    setFlagThresh((m) => ({ ...m, [farmId]: v }));
  };
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <div style={{ fontFamily: font.disp, fontWeight: 700, fontSize: 26,
        textTransform: "uppercase", marginBottom: 20 }}>{cfg.name} — {T("Settings", "Ajustes")}</div>
      {/* ---- Barns ---- */}
      <Eyebrow>{T("Barns — layout per barn", "Galpones — distribución por galpón")}</Eyebrow>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: 14, marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {barns.map((b) => (
            <button key={b} onClick={() => setSelBarn(b)} style={{
              fontFamily: font.mono, fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: selBarn === b ? C.amber : C.panel2,
              color: selBarn === b ? "#15181C" : C.text,
              border: `1px solid ${selBarn === b ? C.amber : C.line}`,
              cursor: "pointer" }}>{b}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
          padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: font.disp, textTransform: "uppercase", fontSize: 14,
            letterSpacing: "0.1em" }}>Barn {selBarn}</div>
          <label style={{ fontSize: 13, color: C.mut }}>{T("Rows", "Filas")}
            <input type="number" inputMode="numeric" value={rowsDraft}
              onChange={(e) => setRowsDraft(e.target.value)}
              onBlur={() => commitBC("rows", rowsDraft, 1, 30, setRowsDraft)}
              onKeyDown={onEnterBlur}
              style={{ ...inputStyle, width: 70, padding: "8px 8px", marginLeft: 8,
                fontFamily: font.mono, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 13, color: C.mut }}>{T("Tiers", "Niveles")}
            <input type="number" inputMode="numeric" value={tiersDraft}
              onChange={(e) => setTiersDraft(e.target.value)}
              onBlur={() => commitBC("tiers", tiersDraft, 1, 12, setTiersDraft)}
              onKeyDown={onEnterBlur}
              style={{ ...inputStyle, width: 70, padding: "8px 8px", marginLeft: 8,
                fontFamily: font.mono, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 13, color: C.mut }}>{T("Floors", "Pisos")}
            <input type="number" inputMode="numeric" value={floorsDraft}
              onChange={(e) => setFloorsDraft(e.target.value)}
              onBlur={commitFloors}
              onKeyDown={onEnterBlur}
              style={{ ...inputStyle, width: 70, padding: "8px 8px", marginLeft: 8,
                fontFamily: font.mono, textAlign: "right" }} />
          </label>
          <div style={{ fontSize: 12, color: C.mut }}>
            ({bc.floors.join(" / ")})
          </div>
          <div style={{ fontSize: 12, color: C.mut }}>
            {barnEntryCount(selBarn)} {T("entries on record for this barn", "registros en este galpón")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
          padding: "12px 0 2px", borderTop: `1px solid ${C.line}` }}>
          <input value={newBarn} onChange={(e) => setNewBarn(e.target.value)}
            placeholder={T("New barn name (e.g. 8A)", "Nombre del galpón nuevo (ej. 8A)")}
            style={{ ...inputStyle, flex: "1 1 180px", maxWidth: 240 }} />
          <select value={newFloors} onChange={(e) => setNewFloors(e.target.value)}
            style={{ ...inputStyle, padding: "12px 8px" }}>
            <option value="1">{T("1 floor", "1 piso")}</option>
            <option value="2">{T("2 floors", "2 pisos")}</option>
            <option value="3">{T("3 floors", "3 pisos")}</option>
          </select>
          <button disabled={!newBarn.trim() ||
              barns.some((b) => b.toLowerCase() === newBarn.trim().toLowerCase())}
            onClick={() => {
              const name = newBarn.trim();
              setFarmBarns((m) => ({ ...m, [farmId]: [...(m[farmId] || cfg.barns), name] }));
              setBarnConfig((o) => ({ ...o,
                [`${farmId}-${name}`]: { ...(o[`${farmId}-${name}`] || {}),
                  floors: floorLabels(parseInt(newFloors, 10) || cfg.floors.length) } }));
              setSelBarn(name); setNewBarn("");
            }}
            style={{ background: newBarn.trim() ? C.amber : C.panel2,
              color: newBarn.trim() ? "#15181C" : C.dis, fontWeight: 600,
              border: `1px solid ${newBarn.trim() ? C.amber : C.line}`, borderRadius: 8,
              padding: "12px 20px", fontSize: 14,
              cursor: newBarn.trim() ? "pointer" : "default" }}>
            {T("Add barn", "Agregar galpón")}
          </button>
          <div style={{ fontSize: 12, color: C.mut }}>
            {LANG === "es" ? `Los galpones nuevos usan los valores de la granja (${cfg.rows} filas · ${cfg.tiers} niveles) — ajústalos arriba. No se pueden quitar si tienen registros.` : `New barns start with farm defaults (${cfg.rows} rows · ${cfg.tiers} tiers) — adjust above after adding. Barns can't be removed once they hold entries.`}
          </div>
        </div>
      </div>
      <Eyebrow>{T("Breed standards — targets by bird age, used for on-track checks", "Estándares — metas por edad del ave, para las alertas de cumplimiento")}</Eyebrow>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: 14, marginBottom: 28, overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px repeat(4, minmax(90px, 1fr))",
          gap: 6, minWidth: 480 }}>
          {[T("Age (wk)", "Edad (sem)"), T("Mort %/wk", "Mort %/sem"), T("Case (lbs)", "Caja (lbs)"), T("Body (lbs)", "Peso (lbs)"), "Unif %"].map((h) => (
            <div key={h} style={{ fontFamily: font.mono, fontSize: 12, color: C.mut }}>{h}</div>
          ))}
          {stds.map((r, i) => (
            [<div key={"w" + i} style={{ alignSelf: "center", fontFamily: font.mono,
              fontSize: 13, color: C.amber }}>{r.wk}</div>,
            ...["mort", "caseW", "body", "unif"].map((k) => (
              <input key={k + i} type="number" step="0.01" value={r[k]}
                onChange={(e) => setStd(i, k, e.target.value)}
                style={{ ...inputStyle, padding: "7px 8px", fontFamily: font.mono,
                  fontSize: 13, textAlign: "right" }} />
            ))]
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.mut, marginTop: 10 }}>
          {T("Values between age anchors are interpolated. Defaults are typical brown-layer targets — replace them with your breeder guide's numbers. Each barn's dashboard compares against the standard at that flock's current age.", "Los valores entre edades se interpolan. Los predeterminados son metas típicas de ponedora café — reemplázalos con los de tu guía de estirpe. Cada galpón se compara con el estándar a la edad actual de su parvada.")}
        </div>
      </div>
      {/* ---- Hot-spot flagging ---- */}
      <Eyebrow>{T("Hot-spot flagging", "Detección de puntos críticos")}</Eyebrow>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: 14, marginBottom: 28, display: "flex", alignItems: "center", gap: 14,
        flexWrap: "wrap" }}>
        {[["auto", T("Automatic — vs barn average", "Automático — vs promedio del galpón")], ["fixed", T("Fixed count", "Cantidad fija")]].map(([m, lbl]) => (
          <button key={m} onClick={() => setFlagMode((o) => ({ ...o, [farmId]: m }))} style={{
            fontFamily: font.mono, fontSize: 13, padding: "9px 14px", borderRadius: 8,
            background: mode === m ? C.amber : C.panel2, color: mode === m ? "#15181C" : C.text,
            border: `1px solid ${mode === m ? C.amber : C.line}`, cursor: "pointer" }}>{lbl}</button>
        ))}
        {mode === "fixed" ? (
          <label style={{ fontSize: 13, color: C.mut }}>{T("Flag a spot at", "Marcar un punto con")}
            <input type="number" inputMode="numeric" value={threshDraft}
              onChange={(e) => setThreshDraft(e.target.value)}
              onBlur={commitThresh}
              onKeyDown={onEnterBlur}
              style={{ ...inputStyle, width: 70, padding: "8px 8px", margin: "0 8px",
                fontFamily: font.mono, textAlign: "right" }} />
            {T("birds per row-section in the selected period", "aves por fila-sección en el periodo elegido")}
          </label>
        ) : (
          <div style={{ fontSize: 12, color: C.mut }}>
            {T("Flags any row-section running ~2.5 standard deviations above its barn-floor average (minimum 3 birds). Adapts to barn size and time range — nothing to tune.", "Marca cualquier fila-sección ~2.5 desviaciones estándar arriba del promedio de su piso (mínimo 3 aves). Se adapta al tamaño y al periodo — no hay nada que ajustar.")}
          </div>
        )}
      </div>
      {/* ---- Accounts ---- */}
          <Eyebrow>{T("Accounts", "Cuentas")} — {cfg.name}</Eyebrow>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder={T("New account name", "Nombre de la cuenta nueva")} style={{ ...inputStyle, flex: "2 1 200px" }} />
              <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={T("4-digit PIN", "PIN de 4 dígitos")} inputMode="numeric"
                style={{ ...inputStyle, flex: "1 1 120px", fontFamily: font.mono }} />
              <button onClick={() => setNewManager((a) => !a)}
                style={{ flex: "1 1 130px", background: newManager ? C.amber : C.panel2,
                  color: newManager ? "#15181C" : C.mut, fontWeight: 600,
                  border: `1px solid ${newManager ? C.amber : C.line}`, borderRadius: 8,
                  padding: "12px 12px", fontSize: 14, cursor: "pointer" }}>
                {newManager ? T("Manager ✓", "Gerente ✓") : T("Manager?", "¿Gerente?")}
              </button>
              <button disabled={!newName.trim() || newPin.length !== 4 || addBusy ||
                  accounts.some((w) => w.name.toLowerCase() === newName.trim().toLowerCase())}
                onClick={async () => {
                  setAddBusy(true); setAddErr("");
                  const { error } = await supabase.functions.invoke("provision-account", {
                    body: { name: newName.trim(), pin: newPin,
                      role: newManager ? "manager" : "worker", farm_id: farmId },
                  });
                  setAddBusy(false);
                  if (error) {
                    let msg = error.message || String(error);
                    try {
                      if (error.context && typeof error.context.json === "function") {
                        const body = await error.context.json();
                        if (body && body.error) msg = body.error;
                      }
                    } catch {}
                    setAddErr(msg);
                    return;
                  }
                  setNewName(""); setNewManager(false); setNewPin("");
                  if (reloadAccounts) await reloadAccounts();
                }}
                style={{ background: (newName.trim() && newPin.length === 4 && !addBusy) ? C.amber : C.panel2,
                  color: (newName.trim() && newPin.length === 4 && !addBusy) ? "#15181C" : C.dis, fontWeight: 600,
                  border: `1px solid ${(newName.trim() && newPin.length === 4) ? C.amber : C.line}`, borderRadius: 8,
                  padding: "12px 20px", fontSize: 14,
                  cursor: (newName.trim() && newPin.length === 4 && !addBusy) ? "pointer" : "default" }}>
                {addBusy ? T("Adding…", "Agregando…") : T("Add", "Agregar")}
              </button>
            </div>
            {addErr && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{addErr}</div>}
            {farmUsers.map((w) => {
              const hasEntries = saved.some((e) => e.user === w.name);
              const isMe = w.name === me;
              return (
                <div key={w.name} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
                  <span style={{ fontSize: 15, width: 110 }}>{w.name}{isMe && <span style={{ color: C.mut, fontSize: 12 }}> {T("(you)", "(tú)")}</span>}</span>
                  <button disabled={isMe || mgBusy === w.id}
                    onClick={() => !isMe && manageAccount(w.id, "set_role",
                      w.role === "manager" ? "worker" : "manager")}
                    style={{ fontFamily: font.mono, fontSize: 12, padding: "5px 10px",
                      background: w.role === "manager" ? "rgba(255,176,32,0.12)" : C.panel2,
                      color: w.role === "manager" ? C.amber : C.mut, borderRadius: 6,
                      border: `1px solid ${w.role === "manager" ? C.amberDim : C.line}`,
                      cursor: isMe ? "default" : "pointer",
                      opacity: mgBusy === w.id ? 0.5 : 1 }}>
                    {LANG === "es" ? (w.role === "manager" ? "GERENTE" : "TRABAJADOR") : w.role.toUpperCase()}
                  </button>
                  <span style={{ flex: 1, fontSize: 12, color: C.mut }}>
                    {hasEntries ? `${saved.filter((e) => e.user === w.name).length} ${T("entries on record", "registros")}` : T("no entries yet", "sin registros aún")}
                  </span>
                  <button disabled={isMe || mgBusy === w.id}
                    onClick={() => !isMe && setConfirmRemove({ ...w, hasEntries })}
                    title={hasEntries ? T("Has entries — will be deactivated, not deleted", "Tiene registros — se desactivará, no se borrará") : ""}
                    style={{ background: "none", border: `1px solid ${C.line}`,
                      color: isMe ? C.faint : C.mut, borderRadius: 6,
                      padding: "5px 12px", fontSize: 12,
                      cursor: isMe ? "default" : "pointer",
                      opacity: mgBusy === w.id ? 0.5 : 1 }}>
                    {mgBusy === w.id ? "…" : T("Remove", "Quitar")}
                  </button>
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: C.mut, marginTop: 10 }}>
              {T("Accounts with logged entries are deactivated instead of deleted — their history keeps its author.", "Las cuentas con registros se desactivan en lugar de borrarse — su historial conserva su autor.")}
            </div>
          </div>
          {inactive.length > 0 && (
            <>
              <div style={{ marginTop: 16 }} />
              <Eyebrow>{T("Deactivated accounts", "Cuentas desactivadas")}</Eyebrow>
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
                {inactive.map((w) => (
                  <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                    <span style={{ fontSize: 15, width: 110, color: C.mut }}>{w.name}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, color: C.faint }}>
                      {w.role.toUpperCase()}</span>
                    <span style={{ flex: 1, fontSize: 12, color: C.mut }}>
                      {T("hidden from sign-in", "oculta del inicio de sesión")}</span>
                    <button disabled={mgBusy === w.id}
                      onClick={() => manageAccount(w.id, "reactivate")}
                      style={{ background: C.panel2, border: `1px solid ${C.line}`,
                        color: C.green, fontWeight: 600, borderRadius: 6,
                        padding: "5px 12px", fontSize: 12, cursor: "pointer",
                        opacity: mgBusy === w.id ? 0.5 : 1 }}>
                      {mgBusy === w.id ? "…" : T("Reinstate", "Reactivar")}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
      {confirmRemove && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 80,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 26, maxWidth: 420, width: "100%" }}>
            <div style={{ fontFamily: font.disp, fontSize: 24, fontWeight: 700,
              textTransform: "uppercase", marginBottom: 6 }}>
              {T("Remove", "Quitar")} {confirmRemove.name}?
            </div>
            <div style={{ color: C.mut, fontSize: 14, marginBottom: 18 }}>
              {confirmRemove.hasEntries
                ? T("This account has logged entries, so it will be deactivated — hidden from sign-in, but its history stays. This can only be undone in the database.",
                    "Esta cuenta tiene registros, así que se desactivará — oculta del inicio de sesión, pero su historial se conserva. Solo se puede revertir en la base de datos.")
                : T("This account has no entries, so it will be permanently deleted. This can't be undone.",
                    "Esta cuenta no tiene registros, así que se borrará permanentemente. Esto no se puede deshacer.")}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmRemove(null)}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text,
                  borderRadius: 8, padding: "12px 20px", fontSize: 14, cursor: "pointer" }}>
                {T("Cancel", "Cancelar")}
              </button>
              <button onClick={() => { const id = confirmRemove.id;
                  setConfirmRemove(null); manageAccount(id, "remove"); }}
                style={{ background: C.red, border: `1px solid ${C.red}`, color: "#fff",
                  fontWeight: 600, borderRadius: 8, padding: "12px 20px", fontSize: 14,
                  cursor: "pointer" }}>
                {confirmRemove.hasEntries ? T("Deactivate", "Desactivar") : T("Delete", "Borrar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
