/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.kie.ai' },
      { protocol: 'https', hostname: '*.kie.ai' },
      { protocol: 'https', hostname: '**.amazon.com' },
      { protocol: 'https', hostname: '**.flipkart.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'rukminim2.flixcart.com' },
    ],
    // Use unoptimized on free hosting to avoid sharp segfault
    unoptimized: true,
  },
  // Treat heavy native packages as external — don't bundle them
  serverExternalPackages: ['sharp', 'archiver', 'node-vibrant'],
  // Suppress build-time type errors from optional packages
  typescript: {
    ignoreBuildErrors: false,
  },
  // Reduce memory pressure on free-tier build
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

module.exports = nextConfig;
