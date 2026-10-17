import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return ['/pedir', '/pedidos', '/pantalla'].map((source) => ({
      source,
      destination: '/',
      permanent: false,
    }));
  },
};

export default nextConfig;
