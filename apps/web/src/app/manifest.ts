import type { MetadataRoute } from 'next';

/**
 * Manifeste PWA : rend la plateforme « installable » sur téléphone et PC
 * (icône sur l'écran d'accueil, ouverture en plein écran sans barre d'URL).
 * Next.js le sert automatiquement sur /manifest.webmanifest et ajoute le
 * <link rel="manifest"> dans le <head>.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'La Forge des Leaders',
    short_name: 'Forge Leaders',
    description: 'Campus numérique privé de formation de La Forge des Leaders.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    lang: 'fr',
    icons: [
      { src: '/icon.png.jpeg', sizes: '192x192', type: 'image/jpeg', purpose: 'any' },
      { src: '/icon.png.jpeg', sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
      { src: '/icon.png.jpeg', sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' },
    ],
  };
}
