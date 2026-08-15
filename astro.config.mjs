import { defineConfig } from "astro/config";

// Served at username.github.io/<repo>/, so every generated asset/link needs
// this prefix -- unlike Vite's `base: "./"` trick, Astro has no relative-URL
// escape hatch and needs the path spelled out.
export default defineConfig({
  base: "/comp4020-ass1-BilalM004/",
});
