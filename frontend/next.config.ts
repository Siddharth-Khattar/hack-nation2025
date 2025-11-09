import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Environment variables are automatically exposed to the client
  // when prefixed with NEXT_PUBLIC_
  // No additional configuration needed for NEXT_PUBLIC_ variables

  // Optional: Add headers for API CORS if needed in development
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_API_BASE_URL || '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
