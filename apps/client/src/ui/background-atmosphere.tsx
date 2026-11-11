import { memo } from 'react';

const particles = Array.from({ length: 24 }, (_, index) => ({
  left: `${(index * 43 + 7) % 100}%`,
  top: `${(index * 29 + 11) % 100}%`,
  width: index % 3 === 0 ? 3 : 2,
  height: index % 3 === 0 ? 3 : 2,
  animationDelay: `${-index * 1.7}s`,
  animationDuration: `${16 + (index % 7) * 3}s`,
}));

export const BackgroundAtmosphere = memo(function BackgroundAtmosphere() {
  return (
    <div className="game-atmosphere" aria-hidden="true">
      <div className="game-floodlights" />
      {particles.map((style, index) => (
        <span key={index} style={style} />
      ))}
    </div>
  );
});
