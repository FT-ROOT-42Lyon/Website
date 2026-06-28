/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ft-root/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.intra.42.fr" },
    ],
  },
};

module.exports = nextConfig;
