/** @type {import('next').NextConfig} */
// Check if we're building (not in dev mode)
const isBuild = process.argv.includes("build");

// GitHub Pages: set BASE_PATH in CI — '' for username.github.io repos, '/repo-name' for project sites.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,
  ...(isBuild && { output: "export" }),
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

