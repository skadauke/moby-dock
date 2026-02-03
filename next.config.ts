import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Capture build time at build (not runtime)
  env: {
    BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
