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
      preset: process.env.NITRO_PRESET || "vercel",
      ...(process.env.NITRO_PRESET === "node-server" || process.env.NITRO_PRESET === "render"
        ? {}
        : {
            output: {
              dir: ".vercel/output",
              serverDir: ".vercel/output/functions/__server.func",
              publicDir: ".vercel/output/static",
            },
          }),
    }),
    react(),
  ],
  build: {
    target: "esnext",
    cssMinify: true,
    minify: "esbuild",
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            if (id.includes("@tanstack")) {
              return "vendor-tanstack";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
          }
        },
      },
    },
  },
  server: {
    port: 8081,
    fs: {
      allow: [".."],
    },
  },
});

