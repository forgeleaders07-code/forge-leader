import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Active l'élévation au survol (cartes cliquables). */
  hoverable?: boolean;
  /** Fond beige (sections secondaires) au lieu de blanc. */
  soft?: boolean;
}

/** Carte du Design System : coins 20 px, ombre douce (Vol 2 §7). */
export function Card({ hoverable, soft, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line ${soft ? 'bg-soft' : 'bg-surface'} shadow-card transition-all duration-200 ${
        hoverable ? 'hover:-translate-y-0.5 hover:shadow-card-hover' : ''
      } ${className}`}
      {...props}
    />
  );
}
