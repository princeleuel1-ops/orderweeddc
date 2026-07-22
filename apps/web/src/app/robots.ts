import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/business/dashboard',
        '/compare',
        '/customer',
        '/wallet',
      ],
    },
    sitemap: 'https://orderweeddc.com/sitemap.xml',
  };
}
