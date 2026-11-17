import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Keep acceptance builds separate from the user's running local application.
  distDir: process.env.MOCKMATE_BROWSER_BUILD === "1" ? ".test-deps/next-browser" : ".next",
  // Verification/recovery links can carry one-use tokens in their query string.
  logging: { incomingRequests: false },
};
export default config;
