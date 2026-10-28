let openDialogs = 0;
let previousOverflow = '';

export function openModalPreservingScroll(dialog: HTMLDialogElement | null) {
  if (!dialog) return () => {};
  const x = window.scrollX;
  const y = window.scrollY;
  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (openDialogs++ === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }
  dialog.showModal();
  // Native dialog autofocus may scroll its original position into view.
  window.scrollTo({ left: x, top: y, behavior: 'instant' });
  return () => {
    dialog.close();
    if (--openDialogs === 0) document.documentElement.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
  };
}
