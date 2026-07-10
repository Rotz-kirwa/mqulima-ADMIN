import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "src/server.ts" },
    }),
    nitro({
      preset: "vercel",
      output: {
        dir: ".vercel/output",
        serverDir: ".vercel/output/functions/__server.func",
        publicDir: ".vercel/output/static",
      },
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
