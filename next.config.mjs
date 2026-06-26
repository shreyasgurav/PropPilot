/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pg-boss", "@prisma/client", "prisma"],
  },
};

export default nextConfig;
