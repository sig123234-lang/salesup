import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['lightningcss', '@tailwindcss/node', '@tailwindcss/postcss'],
  allowedDevOrigins: ['127.0.0.1', 'localhost', '172.30.1.76'],
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
      allowedOrigins: [
        'localhost:3000',
        'localhost:3003',
        'localhost:3010',
        'localhost:3011',
        '127.0.0.1:3010',
        '127.0.0.1:3011',
      ],
    },
  },
};

export default nextConfig;
