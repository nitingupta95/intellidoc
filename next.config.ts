import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images (Google/GitHub avatars, Cloudflare R2 assets)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },

  // Node.js-native packages that must not be bundled into serverless functions
  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "amqplib",
    "bullmq",
    "ioredis",
    "nodemailer",
    "razorpay",
    "pdf-parse",
  ],

  // Prevent ESLint warnings (set to "warn" in the config) from failing the Vercel build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
