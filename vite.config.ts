import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  server: {
    port: 8081,
    fs: {
      allow: [".."],
    },
  },
});
