import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['lightningcss', '@tailwindcss/node', '@tailwindcss/postcss'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3003', 'localhost:3010'],
    },
  },
};

export default nextConfig;
