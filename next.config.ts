import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>/ — assets need the prefix
// there, but local dev and other hosts stay at root.
const onGitHubActions = process.env.GITHUB_ACTIONS === "true";
const repo = "Lifeverse";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: onGitHubActions ? `/${repo}` : "",
  assetPrefix: onGitHubActions ? `/${repo}/` : undefined,
  env: {
    // runtime-visible copy of basePath for hand-built asset URLs (troika font)
    NEXT_PUBLIC_BASE_PATH: onGitHubActions ? `/${repo}` : "",
  },
};

export default nextConfig;
