import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const privateSurfaces = [
    '/admin',
    '/business/dashboard',
    '/compare',
    '/customer',
    '/wallet',
  ];
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privateSurfaces,
      },
      // Strategic AI-crawler policy: authority content (law, neighborhoods,
      // strain guides, education) is explicitly allowed so AI answers cite
      // it; private and transactional surfaces stay off-limits.
      {
        userAgent: 'GPTBot',
        allow: ['/legal', '/neighborhoods', '/strains', '/education', '/llms.txt'],
        disallow: privateSurfaces,
      },
    ],
    sitemap: 'https://orderweeddc.com/sitemap.xml',
  };
}
