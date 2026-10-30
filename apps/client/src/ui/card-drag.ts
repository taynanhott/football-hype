import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';

let cleanup: (() => void) | undefined;

export function showDraggedCard(event: ReactDragEvent<HTMLElement>) {
  cleanup?.();
  const source = event.currentTarget;
  const bounds = source.getBoundingClientRect();
  const preview = source.cloneNode(true) as HTMLElement;
  preview.removeAttribute('id');
  preview.removeAttribute('data-dragging');
  preview.classList.add('dragged-card-preview');
  const offsetX = event.clientX - bounds.left;
  const offsetY = event.clientY - bounds.top;
  Object.assign(preview.style, {
    position: 'fixed',
    width: bounds.width + 'px',
    height: bounds.height + 'px',
    margin: '0',
    transform: 'rotate(-3deg)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    left: bounds.left + 'px',
    top: bounds.top + 'px',
    opacity: '1',
  });
  document.body.appendChild(preview);
  document.body.classList.add('dragging-player-card');
  const blank = document.createElement('canvas');
  blank.width = blank.height = 1;
  event.dataTransfer.setDragImage(blank, 0, 0);
  const move = (e: globalThis.DragEvent) => {
    if (!e.clientX && !e.clientY) return;
    preview.style.left = e.clientX - offsetX + 'px';
    preview.style.top = e.clientY - offsetY + 'px';
  };
  const end = () => {
    preview.remove();
    document.body.classList.remove('dragging-player-card');
    document.removeEventListener('dragover', move);
    document.removeEventListener('drag', move);
    document.removeEventListener('drop', end);
    document.removeEventListener('dragend', end);
    cleanup = undefined;
  };
  document.addEventListener('dragover', move);
  document.addEventListener('drag', move);
  document.addEventListener('drop', end);
  document.addEventListener('dragend', end);
  cleanup = end;
}

export function startCardPointerDrag(event: ReactPointerEvent<HTMLElement>, playerId: string) {
  if (event.button !== 0 || event.pointerType === 'touch') return;
  cleanup?.();
  const pointerId = event.pointerId;
  const source = event.currentTarget;
  let shield: HTMLDivElement | undefined;
  const startX = event.clientX,
    startY = event.clientY;
  let active = false;
  let preview: HTMLElement | undefined;
  let frame = 0;
  let latestX = startX;
  let latestY = startY;
  const paint = () => {
    frame = 0;
    if (preview)
      preview.style.transform = `translate3d(${latestX - startX}px, ${latestY - startY}px, 0) rotate(-3deg)`;
  };
  const bounds = source.getBoundingClientRect();
  const preventNative = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  source.addEventListener('dragstart', preventNative, true);
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
    if (!active) {
      active = true;
      shield = document.createElement('div');
      shield.className = 'card-drag-shield';
      document.body.appendChild(shield);
      shield.setPointerCapture(pointerId);
      preview = source.cloneNode(true) as HTMLElement;
      const originals = [source, ...source.querySelectorAll('*')];
      const copies = [preview, ...preview.querySelectorAll('*')];
      originals.forEach((original, index) => {
        const copy = copies[index] as HTMLElement | SVGElement;
        const computed = getComputedStyle(original);
        // Copy only the properties needed to preserve the card outside its roster.
        for (const property of [
          'display',
          'position',
          'inset',
          'width',
          'height',
          'min-width',
          'min-height',
          'max-width',
          'max-height',
          'box-sizing',
          'padding',
          'margin',
          'border',
          'border-radius',
          'background',
          'color',
          'font',
          'line-height',
          'text-align',
          'white-space',
          'overflow',
          'text-overflow',
          'opacity',
          'z-index',
          'object-fit',
          'image-rendering',
          'flex',
          'flex-direction',
          'align-items',
          'justify-content',
          'gap',
          'grid-template-columns',
        ])
          copy.style.setProperty(property, computed.getPropertyValue(property));
        copy.style.setProperty('animation', 'none', 'important');
        copy.style.setProperty('transition', 'none', 'important');
        copy.style.setProperty('filter', 'none', 'important');
        copy.style.setProperty('pointer-events', 'none', 'important');
      });
      preview.removeAttribute('id');
      preview.removeAttribute('data-dragging');
      preview.classList.add('dragged-card-preview');
      Object.assign(preview.style, {
        position: 'fixed',
        width: bounds.width + 'px',
        height: bounds.height + 'px',
        margin: '0',
        transform: 'rotate(-3deg)',
        pointerEvents: 'none',
        zIndex: '2147483647',
        opacity: '1',
        left: bounds.left + 'px',
        top: bounds.top + 'px',
        willChange: 'transform',
        contain: 'layout style paint',
        right: 'auto',
        bottom: 'auto',
        transition: 'none',
        animation: 'none',
      });
      document.body.appendChild(preview);
      document.body.classList.add('dragging-player-card');
    }
    e.preventDefault();
    latestX = e.clientX;
    latestY = e.clientY;
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const finish = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    cancelAnimationFrame(frame);
    if (shield?.hasPointerCapture(pointerId)) shield.releasePointerCapture(pointerId);
    shield?.remove();
    preview?.remove();
    document.body.classList.remove('dragging-player-card');
    source.removeEventListener('dragstart', preventNative, true);
    window.removeEventListener('blur', abort);
    cleanup = undefined;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', cancel);
    if (!active) return;
    const blockClick = (click: MouseEvent) => {
      click.preventDefault();
      click.stopImmediatePropagation();
    };
    document.addEventListener('click', blockClick, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', blockClick, true), 0);
    if (e.type === 'pointercancel') return;
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('[data-lineup-slot], .reserve-mini, .reserve-section');
    if (!target || target === source || target.matches(':disabled')) return;
    if (target.getAttribute('data-drag-player-id') === playerId) return;

    const transfer = new DataTransfer();
    transfer.setData('text/plain', playerId);
    transfer.effectAllowed = 'move';
    target.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: e.clientX,
        clientY: e.clientY,
      }),
    );
  };
  const cancel = (e: PointerEvent) => finish(e);
  const abort = () => finish(new PointerEvent('pointercancel', { pointerId }));
  cleanup = abort;
  window.addEventListener('blur', abort);
  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', cancel);
}
