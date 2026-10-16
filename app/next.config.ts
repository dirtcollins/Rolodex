import type { NextConfig } from "next";

// Reuse recent views for one minute. Successful saves already call router.refresh(),
// which invalidates Next 16's segment cache and back/forward cache.
const config: NextConfig = {
  devIndicators: false,
  // PGlite (the local database on this Mac) loads its files from disk, so it runs from node_modules, not the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: { staleTimes: { dynamic: 60, static: 60 } },
};
export default config;
