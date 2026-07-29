'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker (une fois, côté navigateur) : c'est ce qui
 * permet au bouton « Installer l'application » d'apparaître sur Android et PC.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
