import type { NextConfig } from "next";
import path from "node:path";

// Reuse recent views for one minute. Successful saves already call router.refresh(),
// which invalidates Next 16's segment cache and back/forward cache.
const config: NextConfig = {
  devIndicators: false,
  experimental: { staleTimes: { dynamic: 60, static: 60 } },
  // Hostinger runs the app directory as the Next project root. The migrations live
  // one level above it, so include them in every server route's traced deployment.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: { "/*": ["../database/**/*.sql"] },
};
export default config;
