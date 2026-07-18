import { HTMLAttributes } from 'react';

type Tone = 'gold' | 'neutral' | 'success' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  gold: 'bg-gold-soft text-gold border-gold/40',
  neutral: 'bg-soft text-muted border-line',
  success: 'bg-success/10 text-success border-success/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  info: 'bg-info/10 text-info border-info/30',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}
