import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@browserbasehq/sdk", "fluent-ffmpeg", "sharp"],
  outputFileTracingIncludes: {
    "/api/facebook": [
      "./node_modules/playwright-core/browsers.json",
    ],
  },
};

export default nextConfig;
