import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    // 고객사에서 필요할 때 불러오는 공개 SDK 모듈이다.
    return [{ source: "/sdk-capture-v1.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
