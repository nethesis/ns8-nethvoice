/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  // Pin the file-tracing root to this project so the standalone build does
  // not trace sibling repositories (no effect on the container build).
  outputFileTracingRoot: __dirname,
  devIndicators: false,
}

module.exports = nextConfig
