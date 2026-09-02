/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/atm/1/:path*",
        destination: "http://localhost:8081/atm/:path*",
      },
      {
        source: "/api/atm/2/:path*",
        destination: "http://localhost:8082/atm/:path*",
      },
      {
        source: "/api/atm/3/:path*",
        destination: "http://localhost:8083/atm/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/:path*",
      },
    ];
  },
};

export default nextConfig;
