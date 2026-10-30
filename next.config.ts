import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers(){return [{source:"/images/bcb-giroc-welcome-v67-:size.webp",headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]}];},
  outputFileTracingExcludes: {"/*": ["./local-assets/**/*"]},
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb"
    },
    proxyClientMaxBodySize: "100mb"
  }
};

export default nextConfig;
