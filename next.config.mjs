/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Zapobiega clickjackingowi — strona nie może być osadzona w iframe
  { key: 'X-Frame-Options', value: 'DENY' },
  // Wyłącza MIME sniffing przeglądarki
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Ogranicza dane referrer przy przechodzeniu na zewnętrzne strony
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Wymusza HTTPS (1 rok, z subdomenami)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Wyłącza przestarzałe funkcje przeglądarki
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Dodatkowa ochrona XSS w starszych przeglądarkach
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
