import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the preview's external hostname
  allowedDevOrigins: [
    "3000-" + (process.env.BASE44_PUBLIC_HOST_SUFFIX || "preview.example"),
  ],
};

export default nextConfig;
