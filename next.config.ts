import type { NextConfig } from "next";
import os from "node:os";

const localNetworkHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter(
    (address): address is os.NetworkInterfaceInfo =>
      address?.family === "IPv4" && !address.internal
  )
  .map((address) => address.address);

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sharp", "@aws-sdk/client-s3"],
  allowedDevOrigins: localNetworkHosts,
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Áp dụng các header này cho mọi route
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
