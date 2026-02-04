/** @type {import('next').NextConfig} */
// Check if we're building (not in dev mode)
const isBuild = process.argv.includes('build');

const nextConfig = {
  reactStrictMode: true,
  // Only use static export when building (not in dev mode)
  ...(isBuild && { output: 'export' }),
  // Only use basePath when building for GitHub Pages (not in dev)
  basePath: isBuild ? '/vdid-asset-gen' : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

