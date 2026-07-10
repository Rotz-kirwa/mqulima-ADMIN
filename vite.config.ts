import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    TanStackRouterVite({ autoCodeSplitting: true }),
    tanstackStart({
      server: { entry: "src/server.ts" },
    }),
    react(),
  ],
  server: {
    port: 8081,
    fs: {
      allow: [".."],
    },
  },
});
