/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pg-boss and Prisma use native Node.js APIs — must not be bundled by webpack.
  experimental: {
    serverComponentsExternalPackages: ["pg-boss", "@prisma/client", "prisma"],
  },
};

export default nextConfig;

