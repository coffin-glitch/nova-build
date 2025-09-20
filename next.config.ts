import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname, // pin tracing to THIS folder
};
export default nextConfig;
