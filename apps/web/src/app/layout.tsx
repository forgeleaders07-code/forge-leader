import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { PwaRegister } from '@/components/pwa-register';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: {
    default: 'La Forge des Leaders — Campus privé',
    template: '%s · La Forge des Leaders',
  },
  description: 'Campus numérique privé de formation de La Forge des Leaders.',
  robots: { index: false, follow: false }, // campus privé : pas d'indexation
  icons: { icon: '/icon.png.jpeg', apple: '/icon.png.jpeg' }, // logo en icône d'onglet
  // Installation « comme une appli » sur iPhone/iPad (écran d'accueil).
  appleWebApp: { capable: true, title: 'La Forge des Leaders', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#121212',
};

/** Applique le thème persisté AVANT la première peinture (pas de flash). */
const themeScript = `
try {
  var t = localStorage.getItem('forge.theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
