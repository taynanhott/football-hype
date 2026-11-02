import { Icon } from '../../ui/icons';

type FacilityTab = { id: string; label: string; fullLabel: string; icon: string };
export function FacilityTabs({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly FacilityTab[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <nav
      className="facility-mobile-tabs facility-two-row-tabs"
      role="tablist"
      aria-label={label}
      data-count={items.length}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-label={item.fullLabel}
          title={item.fullLabel}
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
        >
          <Icon name={item.icon} size={16} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
