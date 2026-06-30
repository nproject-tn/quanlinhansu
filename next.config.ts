import type { NextConfig } from "next";
import os from "node:os";

const localNetworkHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter(
    (address): address is os.NetworkInterfaceInfo =>
      address?.family === "IPv4" && !address.internal
  )
  .map((address) => address.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: localNetworkHosts,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
