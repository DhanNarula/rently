import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@browserbasehq/sdk", "fluent-ffmpeg", "sharp"],
};

export default nextConfig;
