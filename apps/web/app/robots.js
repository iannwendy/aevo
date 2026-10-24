const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.CLIENT_URL || 'http://localhost:3000';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products'],
        disallow: [
          '/admin/',
          '/account/',
          '/cart',
          '/checkout/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/logout',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
