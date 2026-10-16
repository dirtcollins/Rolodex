import type { NextConfig } from "next";

// Reuse recent views for one minute. Successful saves already call router.refresh(),
// which invalidates Next 16's segment cache and back/forward cache.
const config: NextConfig = { devIndicators: false, experimental: { staleTimes: { dynamic: 60, static: 60 } } };
export default config;
