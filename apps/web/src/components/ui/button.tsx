'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  // Bouton principal : fond or (Vol 2 §6)
  primary:
    'bg-gold text-white shadow-btn hover:bg-gold-600 active:scale-[0.98] disabled:hover:bg-gold',
  // Bouton secondaire : fond blanc/surface, contour gris
  secondary:
    'border border-line bg-surface text-ink hover:border-gold hover:text-ink active:scale-[0.98]',
  ghost: 'text-muted hover:bg-soft hover:text-ink',
  danger: 'bg-danger text-white shadow-btn hover:opacity-90 active:scale-[0.98]',
  success: 'bg-success text-white shadow-btn hover:opacity-90 active:scale-[0.98]',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

/** Bouton du Design System : coins 12 px, transition fluide, icône bienvenue. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center rounded-btn font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
});
