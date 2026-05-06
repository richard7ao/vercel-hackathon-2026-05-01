import type { NextConfig } from "next";
import { withWorkflow } from "@workflow/next";

const nextConfig: NextConfig = {
  // Playwright + Tier 4 verify hit 127.0.0.1:3030; Next 16 blocks cross-origin dev assets by default.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default withWorkflow(nextConfig);
