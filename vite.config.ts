// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// The Lovable wrapper deliberately injects only VITE_* variables. ASTERA's
// provider configuration is server-only and uses process.env, so explicitly
// load the root env file into the Vite/TanStack server process. This does not
// expose these values to the browser bundle (nothing is added to `define`).
const serverMode = process.env.NODE_ENV === "production" ? "production" : "development";
Object.assign(process.env, loadEnv(serverMode, process.cwd(), ""));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
