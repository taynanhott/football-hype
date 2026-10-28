export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <img
      className="football-hype-mark"
      src="/brand/football-hype.svg"
      alt="Football Hype"
      width={size}
      height={size}
    />
  );
}
