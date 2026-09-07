const rawBackendUrl =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "http://bank_backend:8080"
    : "http://localhost:8080");
const backendUrl = rawBackendUrl.replace(/\/:path\*$/, "").replace(/\/+$/, "");

function getAtmDestination(envUrl, port) {
  let base =
    envUrl ||
    (process.env.NODE_ENV === "production"
      ? `http://bank_atm:${port}`
      : `http://localhost:${port}`);
  base = base.replace(/\/:path\*$/, "").replace(/\/+$/, "");
  if (!base.endsWith("/atm")) {
    base = `${base}/atm`;
  }
  return `${base}/:path*`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/atm/1/:path*",
        destination: getAtmDestination(process.env.ATM_1_URL, 8081),
      },
      {
        source: "/api/atm/2/:path*",
        destination: getAtmDestination(process.env.ATM_2_URL, 8082),
      },
      {
        source: "/api/atm/3/:path*",
        destination: getAtmDestination(process.env.ATM_3_URL, 8083),
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

