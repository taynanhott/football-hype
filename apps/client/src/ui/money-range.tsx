import type { InputHTMLAttributes, CSSProperties } from 'react';

export function MoneyRange({
  value,
  min = 0,
  max = 100,
  step,
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
  // Native range inputs snap off-step initial values, while the fill uses the stored value.
  // Accept that value exactly; consumers still apply their monetary increments on change.
  const numericStep = Number(step ?? 1);
  const offset = Number(value ?? lower) - lower;
  const aligned =
    numericStep > 0 && Math.abs(offset / numericStep - Math.round(offset / numericStep)) < 1e-8;
  const effectiveStep = step === 'any' || !aligned ? 'any' : step;
  return (
    <input
      {...props}
      type="range"
      step={effectiveStep}
      min={min}
      max={upper}
      value={value}
      className={`money-range ${className}`}
      style={{ ...style, '--money-progress': `${progress}%` } as CSSProperties}
    />
  );
}
