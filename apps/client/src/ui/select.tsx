import { Children, isValidElement, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type OptionProps = { value?: string | number; children: ReactNode; disabled?: boolean };

export function Option({ children }: OptionProps) {
  return <>{children}</>;
}

function optionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? optionText(child.props.children)
        : String(child),
    )
    .join('');
}

export function Select({
  children,
  value,
  onValueChange,
  disabled = false,
  id,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child) || child.type !== Option) return [];
    const text = optionText(child.props.children);
    return [{ ...child.props, text, value: String(child.props.value ?? text) }];
  });
  const selected = options.findIndex((option) => option.value === String(value));
  function close() {
    menu.current?.hidePopover();
    setOpen(false);
  }
  function show() {
    if (disabled) return;
    setActive(
      selected >= 0 && !options[selected]?.disabled
        ? selected
        : Math.max(
            0,
            options.findIndex((option) => !option.disabled),
          ),
    );
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    close();
    trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const button = trigger.current;
    const list = menu.current;
    list.showPopover();
    function position() {
      const rect = button.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = below < 200 && above > below;
      const height = Math.min(320, Math.max(80, up ? above : below));
      const width = Math.min(rect.width, window.innerWidth - 24);
      Object.assign(list.style, {
        width: `${width}px`,
        maxHeight: `${height}px`,
        left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
        top: up ? 'auto' : `${rect.bottom + 6}px`,
        bottom: up ? `${window.innerHeight - rect.top + 6}px` : 'auto',
      });
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      list.hidePopover();
    };
  }, [open]);
  useLayoutEffect(() => {
    if (open)
      menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  return (
    <span className={`game-select ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        className="game-select-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'Tab' || event.key === 'Escape') {
            close();
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (!open) {
              show();
              return;
            }
            const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]));
            const current = enabled.indexOf(active);
            const next =
              event.key === 'Home'
                ? enabled[0]
                : event.key === 'End'
                  ? enabled.at(-1)
                  : enabled[
                      (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) %
                        enabled.length
                    ];
            if (next !== undefined) setActive(next);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(active);
            else show();
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            search.current = {
              text:
                (now - search.current.time < 700 ? search.current.text : '') +
                event.key.toLocaleLowerCase(),
              time: now,
            };
            const match = options.findIndex(
              (option) =>
                !option.disabled && option.text.toLocaleLowerCase().startsWith(search.current.text),
            );
            if (match >= 0) {
              if (open) setActive(match);
              else onValueChange(options[match]!.value);
            }
          }
        }}
      >
        <span className="game-select-value">{options[selected]?.children ?? 'Selecione'}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        ref={menu}
        id={listId}
        className="game-select-menu"
        popover="auto"
        role="listbox"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        aria-label={ariaLabel ?? 'Opções'}
        onToggle={(event) => {
          if (event.newState === 'closed') setOpen(false);
        }}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${listId}-${index}`}
            data-index={index}
            data-value={option.value}
            role="option"
            aria-selected={index === selected}
            aria-disabled={option.disabled || undefined}
            className={`game-select-option ${active === index ? 'is-active' : ''}`}
            onPointerMove={() => {
              if (!option.disabled) setActive(index);
            }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{option.children}</span>
            <span className="game-select-check" aria-hidden="true">
              {index === selected ? '✓' : ''}
            </span>
          </div>
        ))}
        {!options.length && <div className="game-select-empty">Nenhuma opção disponível</div>}
      </div>
    </span>
  );
}
