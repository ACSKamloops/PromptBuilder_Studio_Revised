import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence monorepo root warning in dev/build
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Allow localhost/127.0.0.1 for Next dev asset requests to avoid noisy warnings
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
};

export default nextConfig;
