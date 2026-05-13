import { useEffect } from 'react';

/**
 * Закрывает попап по нажатию мыши вне элемента rootRef (mousedown на document).
 */
export function useOutsidePointerClose(rootRef, isOpen, setOpen) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (event) => {
      const root = rootRef?.current;
      if (!root || root.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen, setOpen, rootRef]);
}
