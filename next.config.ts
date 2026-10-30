import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Les photos de retard (5 Mo maximum) transitent par une action serveur.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
