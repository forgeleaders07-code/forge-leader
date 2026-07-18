/**
 * Client API minimaliste avec gestion des tokens :
 *  - access token en mémoire (jamais en localStorage : réduit l'impact XSS) ;
 *  - refresh token en localStorage (compromis MVP, à migrer vers un cookie
 *    httpOnly quand l'API et le front partageront un domaine) ;
 *  - refresh automatique et transparent sur 401.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const REFRESH_KEY = 'forge.refreshToken';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function setSession(tokens: { accessToken: string; refreshToken: string }): void {
  accessToken = tokens.accessToken;
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearSession(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}

export function hasSession(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem(REFRESH_KEY);
}

/** Token d'accès courant (connexion temps réel) — jamais persisté. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Origine de l'API sans le préfixe /api/v1 (connexion WebSocket). */
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

async function tryRefresh(): Promise<boolean> {
  // Une seule requête de refresh à la fois, partagée entre les appels concurrents
  refreshPromise ??= (async () => {
    const stored = localStorage.getItem(REFRESH_KEY);
    if (!stored) return false;
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    });
    if (!res.ok) {
      clearSession();
      return false;
    }
    setSession(await res.json());
    return true;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function api<T>(path: string, init?: RequestInit & { retried?: boolean }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !init?.retried && (await tryRefresh())) {
    return api<T>(path, { ...init, retried: true });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message
      ? Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message
      : `Erreur ${res.status}`;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─────────────────────────── Auth ───────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const result = await api<{ accessToken: string; refreshToken: string; user: AuthUser }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  setSession(result);
  return result.user;
}

export async function activateAccount(
  userId: string,
  token: string,
  password: string,
): Promise<AuthUser> {
  const result = await api<{ accessToken: string; refreshToken: string; user: AuthUser }>(
    '/auth/activate',
    { method: 'POST', body: JSON.stringify({ userId, token, password }) },
  );
  setSession(result);
  return result.user;
}

export async function logout(): Promise<void> {
  const stored = localStorage.getItem(REFRESH_KEY);
  if (stored) {
    await api('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: stored }),
    }).catch(() => undefined); // le logout local prime
  }
  clearSession();
}
