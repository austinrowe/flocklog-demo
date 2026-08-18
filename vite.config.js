import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The demo build is what gets published to GitHub Pages, which serves it from
// a /flocklog-demo/ subpath. Everything else stays at the root so local dev
// and any future real deployment are unaffected.
export default defineConfig(({ mode }) => ({
  base: mode === "demo" ? "/flocklog-demo/" : "/",
  plugins: [react()],
}));
