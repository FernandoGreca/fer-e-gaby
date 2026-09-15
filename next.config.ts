import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/fer-e-gabi",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
