/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-real-browser', 'sleep', 'xvfb'],
  },
};

export default nextConfig;
