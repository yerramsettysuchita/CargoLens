import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for React
  reactStrictMode: true,

  // Production image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },

  // Headers — security + no caching for HTML
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

};

export default nextConfig;
