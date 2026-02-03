import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";

const nextConfig: NextConfig = {
  // Capture build time at build (not runtime)
  env: {
    BUILD_TIME: new Date().toISOString(),
  },
};

export default withAxiom(nextConfig);
