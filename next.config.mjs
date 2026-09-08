/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }
        ]
      },
      {
        source: "/api/health",
        headers: [
          { key: "Cache-Control", value: "no-store" }
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
        ]
      },
      {
        source: "/apply/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
        ]
      },
      {
        source: "/sponsor/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
        ]
      },
      {
        source: "/affiliate/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
        ]
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
        ]
      }
    ];
  },
  images: { remotePatterns: [] }
};

export default nextConfig;
