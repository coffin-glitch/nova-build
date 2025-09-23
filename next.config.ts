import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname, // pin tracing to THIS folder
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};
export default nextConfig;
