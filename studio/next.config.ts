import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence monorepo root warning in dev/build
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Note: Playwright will warn about dev origins; acceptable for tests
};

export default nextConfig;
