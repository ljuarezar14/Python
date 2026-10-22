import type { NextConfig } from "next";
import { WORKER_POLICY, commonHeaders } from "./src/lib/security-headers.ts";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const common = commonHeaders(process.env.NODE_ENV === "production");
    return [
      { source: "/:path*", headers: common },
      { source: "/execution/:path*", headers: [{ key: "Content-Security-Policy", value: WORKER_POLICY }] },
      { source: "/pyodide/:path*", headers: [{ key: "Content-Security-Policy", value: WORKER_POLICY }] },
    ];
  },
};

export default nextConfig;
