import type { NextConfig } from 'next';

// This folder is the project root, even when a package-lock.json sits in a
// folder above it (Next would otherwise guess the root and warn).
const root = process.cwd();

const config: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
  // PGlite ships its own WASM; keep it out of the server bundle.
  serverExternalPackages: ['@electric-sql/pglite'],
  // This project's AGENTS.md is the brief; don't let `next dev` add to it
  // (AGENTS.md already points agents at node_modules/next/dist/docs/).
  agentRules: false,
  // No floating dev badge (it would show up in screenshots).
  devIndicators: false,
};

export default config;
