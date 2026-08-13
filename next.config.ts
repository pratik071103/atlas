import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin file tracing to this project. Without it Next walks up to the nearest
  // lockfile it can find, which on a shared machine may sit above the repo.
  outputFileTracingRoot: path.resolve(),

  // The MongoDB driver and the Dodo server SDK are Node-only: keeping them out
  // of the bundler means route handlers `require` them at runtime instead of
  // Next trying to trace/bundle their optional native dependencies.
  serverExternalPackages: ["mongodb", "dodopayments"],
};

export default nextConfig;
