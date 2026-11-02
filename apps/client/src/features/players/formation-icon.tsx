import { FORMATIONS, type Formation } from '@football/shared';

export function FormationIcon({ formation }: { formation: Formation }) {
  return (
    <svg
      className="formation-option-icon"
      viewBox="0 0 32 40"
      width="22"
      height="28"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="36"
        rx="2"
        fill="none"
        stroke="currentColor"
        opacity=".5"
      />
      <path
        d="M2 20h28M10 2v6h12V2M10 38v-6h12v6"
        fill="none"
        stroke="currentColor"
        opacity=".35"
      />
      {FORMATIONS[formation].map((slot, index) => (
        <circle
          key={index}
          cx={4 + slot.x * 0.24}
          cy={4 + slot.y * 0.32}
          r="1.35"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
