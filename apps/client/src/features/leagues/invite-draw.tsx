import { useEffect, useRef } from 'react';
import { PixelBadge } from '../../ui/pixel-badge';
type Club = { id: string; name: string; crestUrl?: string | undefined };
export function InviteDraw({
  clubs,
  result,
  onFinish,
}: {
  clubs: Club[];
  result: string | undefined;
  onFinish: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    if (!result || !strip.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = strip.current.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5600px)' }],
      { duration: reduced ? 1 : 6000, easing: 'cubic-bezier(.18,.75,.35,1)', fill: 'forwards' },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    animation.onfinish = () => {
      timer = setTimeout(() => finish.current(), 900);
    };
    return () => {
      animation.cancel();
      clearTimeout(timer);
    };
  }, [result]);
  return (
    <div className="roulette-panel">
      <div className="roulette-window">
        <div className="roulette-pointer" />
        <div ref={strip} className="roulette-strip invite-draw-strip">
          {Array.from({ length: 50 }, (_, i) => {
            const club = clubs.find(
              (c) => c.id === (i === 40 && result ? result : clubs[i % clubs.length]?.id),
            );
            return (
              <div className="roulette-card" key={i}>
                <PixelBadge
                  name={club?.name ?? ''}
                  {...(club?.crestUrl ? { url: club.crestUrl } : {})}
                  size={64}
                />
                <strong>{club?.name}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
