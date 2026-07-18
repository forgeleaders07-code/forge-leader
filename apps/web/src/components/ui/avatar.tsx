export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
}

/** Avatar : photo si disponible, sinon initiales sur fond or doux. */
export function Avatar({ name, src, size = 36 }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-gold-soft font-semibold text-gold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </span>
  );
}
