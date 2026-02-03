import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Capture build/deployment time at build time
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
