import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@auditor/classifier", "@auditor/db", "@auditor/pipeline", "@auditor/tax-pack"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
};
export default config;
