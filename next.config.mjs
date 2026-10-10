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
    useTypeScriptCli: true,
  },
};

export default analyzer(nextConfig);
