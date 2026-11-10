import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Verification/recovery links can carry one-use tokens in their query string.
  logging: { incomingRequests: false },
};
export default config;
