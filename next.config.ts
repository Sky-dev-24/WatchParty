import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker + clustering
  // Creates a minimal production build in .next/standalone
  output: "standalone",

  // Allow iframe embedding for /embed/* routes
  async headers() {
    return [
      {
        source: "/embed/:slug*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
