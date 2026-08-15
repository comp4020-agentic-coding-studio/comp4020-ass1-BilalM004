import { defineConfig } from "astro/config";

// Served at username.github.io/<repo>/, so every generated asset/link needs
// this prefix -- unlike Vite's `base: "./"` trick, Astro has no relative-URL
// escape hatch and needs the path spelled out.
export default defineConfig({
  base: "/comp4020-ass1-BilalM004/",
  // This repo lives on a Windows-mounted drive under WSL (/mnt/c/...), where
  // inotify events from edits often don't reach chokidar -- HMR silently goes
  // stale without this. Polling costs a bit of CPU but is reliable here.
  vite: {
    server: {
      watch: { usePolling: true, interval: 300 },
    },
  },
});
