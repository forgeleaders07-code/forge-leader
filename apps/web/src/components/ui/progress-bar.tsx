export interface ProgressBarProps {
  /** Pourcentage 0–100. */
  value: number;
  /** Hauteur en px (défaut 6). */
  height?: number;
  className?: string;
}

/** Barre de progression or (Vol 2 §4 : la progression est premium). */
export function ProgressBar({ value, height = 6, className = '' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-line ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full bg-gold transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
