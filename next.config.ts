import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers(){return [{source:"/:path*",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"X-Frame-Options",value:"SAMEORIGIN"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
    {key:"Content-Security-Policy",value:"frame-ancestors 'self'; base-uri 'self'"}
  ]},{source:"/images/bcb-giroc-welcome-v67-:size.webp",headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]}];},
  outputFileTracingExcludes: {"/*": ["./local-assets/**/*"]},
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb"
    },
    proxyClientMaxBodySize: "100mb"
  }
};

export default nextConfig;
