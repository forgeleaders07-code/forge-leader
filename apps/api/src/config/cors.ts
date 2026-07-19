/**
 * Origines autorisées (CORS) — lues depuis FRONTEND_URL, qui peut contenir
 * PLUSIEURS URLs séparées par des virgules (ex. domaine de prod + previews
 * Vercel + localhost pour le dev). Une seule source de vérité, réutilisée par
 * l'API HTTP (main.ts) et la passerelle temps réel (realtime.gateway).
 */
export function allowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, '')) // sans slash final
    .filter(Boolean);
}
