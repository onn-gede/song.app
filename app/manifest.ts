import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SongApp BCBgiroc',
    short_name: 'SongApp',
    description: 'Cântările și programele BCB Giroc',
    lang: 'ro',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7f1',
    theme_color: '#245b40',
    icons: [
      {src: '/icons/songapp-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/songapp-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/songapp-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
    ]
  };
}
