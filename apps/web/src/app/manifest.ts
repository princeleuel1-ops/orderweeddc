import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Order Weed DC - Cannabis Directory',
    short_name: 'Order Weed DC',
    description: 'Verified D.C. Medical Cannabis Dispensaries, Delivery Services, Menus & Deals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070b0d',
    theme_color: '#2ee27f',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
