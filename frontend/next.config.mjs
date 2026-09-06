const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/atm/1/:path*",
        destination: process.env.ATM_1_URL || "http://localhost:8081/atm/:path*",
      },
      {
        source: "/api/atm/2/:path*",
        destination: process.env.ATM_2_URL || "http://localhost:8082/atm/:path*",
      },
      {
        source: "/api/atm/3/:path*",
        destination: process.env.ATM_3_URL || "http://localhost:8083/atm/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
