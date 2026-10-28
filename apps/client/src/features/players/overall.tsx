export function Overall({ base, modifier = 0 }: { base: number; modifier?: number }) {
  return (
    <span className="overall-value">
      {base}
      {modifier !== 0 && (
        <span className={modifier > 0 ? 'overall-modifier positive' : 'overall-modifier negative'}>
          {modifier > 0 ? '+' : ''}
          {modifier}
        </span>
      )}
    </span>
  );
}
