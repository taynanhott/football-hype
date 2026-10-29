import { PixelBadge } from './pixel-badge';
import { type ClubKit } from '@football/shared';
const PATHS: Record<string, string> = {
  logout: 'M9 4H4v16h5M10 12h11M17 8l4 4-4 4',
  back: 'M20 12H4M10 6l-6 6 6 6',
  gear: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
  lineup: 'M3 3h18v18H3zM8 8h1M15 8h1M11 12h2M7 16h1M16 16h1M11 19h2',
  matches: 'M3 4h18v14H3zM8 21h8M12 18v3M10 8l5 3-5 3z',
  trophies: 'M5 3h14v8l-7 4-7-4zM8 5h8v4l-4 3-4-3M12 15v5M8 21h8M3 5v8l3 2M21 5v8l-3 2',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  kickoff: 'M4 21V3l14 5-14 5M3 21h7M15 16h5v5h-5z',
  pitch: 'M3 4h18v16H3zM12 4v16M3 9h4v6H3M21 9h-4v6h4M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  entrance: 'M4 21V7l8-4 8 4v14M8 21V10h8v11M2 21h20M10 6h4',
  food: 'M5 3v6M8 3v6M11 3v6M5 7h6M8 9v12M19 3c-4 3-4 8 0 9v9M19 3v9',
  shirt: 'M8 3l4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4z',
  hospitality: 'M5 21h14M8 21l1-7M16 21l-1-7M5 3h14l-2 11H7zM6 8h12M12 3v11',
  trophy:
    'M7 3h10v5a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 13v6M8 21h8M9 19h6',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12l2 2 4-5',
  handshake: 'M3 8l4-3 5 2 5-2 4 3-3 9-4 3-5-2-4-4zM7 5l5 2-4 5 3 2 5-5M11 14l5 4',
  balance: 'M12 3v17M6 21h12M4 7h16M6 7l-4 8h8zM18 7l-4 8h8z',
  bolt: 'M14 2L4 14h7l-1 8L21 9h-8z',
  connections:
    'M12 4L4 19h16zM15 4a3 3 0 1 0-6 0 3 3 0 0 0 6 0M7 19a3 3 0 1 0-6 0 3 3 0 0 0 6 0M23 19a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  counterattack: 'M4 20L20 4M10 4h10v10M4 10v10h10',
  width: 'M4 4v16M20 4v16M8 12h8M10 8l-4 4 4 4M14 8l4 4-4 4',
  search: 'M21 21l-5-5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0',
  tactics: 'M3 3h18v18H3zM7 16l4-5 5 3 2-7M14 7h4v4M6 7h2M7 6v2',
  megaphone: 'M3 9v6h4l12 5V4L7 9H3zM7 15l2 6h4l-2-4',
  menu: 'M3 6h18M3 12h18M3 18h18',
  home: 'M3 10l9-7 9 7v11h-6v-8H9v8H3z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  squad:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  market: 'M4 7h16M16 3l4 4-4 4M20 17H4M8 13l-4 4 4 4',
  stadium:
    'M3 9c0-8 18-8 18 0v8c0 6-18 6-18 0zM3 9c0 6 18 6 18 0M7 12v7M12 14v7M17 12v7M8 7h8v3H8z',
  training: 'M3 6v12M7 3v18M17 3v18M21 6v12M7 12h10',
  recovery: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  finance: 'M3 5h18v15H3zM3 9h18M16 14h3',
  calendar: 'M3 5h18v16H3zM7 2v6M17 2v6M3 10h18M7 14h3M14 14h3',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  ball: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 7l5 4-2 6H9l-2-6zM12 2v5M2 9l5 2M22 9l-5 2M6 20l3-3M18 20l-3-3',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.ball} />
    </svg>
  );
}
export function ClubBadge({
  name,
  size = 44,
  alternate = false,
  kit,
}: {
  name: string;
  size?: number;
  alternate?: boolean;
  kit?: ClubKit;
}) {
  void alternate;
  void kit;
  return <PixelBadge name={name} size={size} />;
}
