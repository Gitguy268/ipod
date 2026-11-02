import withBundleAnalyzer from "@next/bundle-analyzer";

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "export",
  basePath: "/ipod",
  turbopack: {},
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  compiler: {
    styledComponents: true,
  },
  experimental: {
    // "typescript" resolves to TypeScript 6 here so that tools needing its JavaScript API
    // (ESLint, and Next.js itself) keep working; `pnpm type-check` runs TypeScript 7.
    useTypeScriptCli: false,
  },
};

export default analyzer(nextConfig);
