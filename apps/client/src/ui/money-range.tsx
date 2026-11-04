import type { InputHTMLAttributes, CSSProperties } from 'react';

export function MoneyRange({
  value,
  min = 0,
  max = 100,
  className = '',
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const lower = Number(min);
  const upper = Math.max(Number(max), Number(value ?? min));
  const progress =
    upper > lower
      ? Math.max(0, Math.min(100, ((Number(value ?? lower) - lower) / (upper - lower)) * 100))
      : 0;
  return (
    <input
      {...props}
      type="range"
      min={min}
      max={upper}
      value={value}
      className={`money-range ${className}`}
      style={{ ...style, '--money-progress': `${progress}%` } as CSSProperties}
    />
  );
}
