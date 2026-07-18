'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Bascule clair/sombre persistée (palette sombre dédiée, Vol 2 §29). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('forge.theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className="rounded-btn border border-line bg-surface p-2 text-muted transition hover:text-ink"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
