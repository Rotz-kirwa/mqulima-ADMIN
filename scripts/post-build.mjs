#!/usr/bin/env node
// post-build.mjs — Restructure Nitro's dist/ output into Vercel Build Output API v3 format
// Run after: vite build
// Produces: .vercel/output/{config.json, static/, functions/__server.func/}

import { existsSync, mkdirSync, cpSync, copyFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const dist = resolve(root, "dist");
const out = resolve(root, ".vercel", "output");

if (!existsSync(dist)) {
  console.error("❌ dist/ not found — run npm run build first");
  process.exit(1);
}

// 1. Clean and create .vercel/output
mkdirSync(out, { recursive: true });

// 2. Copy config.json (Vercel Build Output API v3 route config)
copyFileSync(resolve(dist, "config.json"), resolve(out, "config.json"));
console.log("✓ config.json");

// 3. Copy static assets (dist/client → .vercel/output/static)
const staticOut = resolve(out, "static");
mkdirSync(staticOut, { recursive: true });
cpSync(resolve(dist, "client"), staticOut, { recursive: true });
console.log("✓ static/");

// 4. Copy server function (dist/server → .vercel/output/functions/__server.func)
const funcOut = resolve(out, "functions", "__server.func");
mkdirSync(funcOut, { recursive: true });
cpSync(resolve(dist, "server"), funcOut, { recursive: true });

// Rename server.js → index.mjs (Vercel Node.js function entry point)
import { renameSync } from "fs";
const serverJs = resolve(funcOut, "server.js");
const indexMjs = resolve(funcOut, "index.mjs");
if (existsSync(serverJs)) {
  renameSync(serverJs, indexMjs);
}

// Write .vc-config.json (tells Vercel this is a Node.js function)
import { writeFileSync } from "fs";
writeFileSync(
  resolve(funcOut, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs20.x", handler: "index.mjs", launcherType: "Nodejs" }, null, 2)
);
console.log("✓ functions/__server.func/");

console.log("\n✅ .vercel/output/ ready for deployment");
