export function MatchPlayerIcon({ kind }: { kind: 'goal' | 'assist' | 'substitution' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'goal' ? (
        <>
          <circle cx="12" cy="12" r="10" fill="#fffdf0" stroke="#143d2d" />
          <path d="m12 7 5 4-2 6H9l-2-6Z" fill="#143d2d" stroke="#143d2d" />
          <path
            d="m12 2 0 5M2.5 9l4.5 2M5.5 20 3 15m6 2-2 4m8-4 2 4m0-10 4.5-2M21 15l-2.5 5"
            stroke="#143d2d"
          />
        </>
      ) : kind === 'assist' ? (
        <>
          <path d="M3 4h7l1 8 4 2 5 1q2 1 2 4H2v-7Z" fill="#f7da73" />
          <path d="m10 9 3-1m-2 4 3-1M2 19h20M5 19v3m5-3v3m7-3v3m4-3v3" />
        </>
      ) : (
        <>
          <path d="M4 10a8 8 0 0 1 14-4l2 2M20 3v5h-5M20 14a8 8 0 0 1-14 4l-2-2M4 21v-5h5" />
        </>
      )}
    </svg>
  );
}
