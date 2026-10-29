import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingExcludes: {"/*": ["./local-assets/**/*"]},
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb"
    },
    proxyClientMaxBodySize: "100mb"
  }
};

export default nextConfig;
