import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
