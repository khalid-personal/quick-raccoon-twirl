import { useEffect } from 'react';

const locks = new WeakMap<Document, { count: number; restore: () => void }>();

/** Non-modal windows must lock scrolling without blocking the workspace dock. */
export function usePopupScrollLock(visible: boolean) {
  useEffect(() => {
    if (!visible) return;
    const doc = document;
    let lock = locks.get(doc);
    if (!lock) {
      const elements = [doc.documentElement, doc.body];
      const previous = elements.map(element => ({
        overflow: element.style.overflow,
        overscrollBehavior: element.style.overscrollBehavior,
      }));
      elements.forEach(element => {
        // A hidden body becomes a scroll container and moves sticky menu anchors.
        element.style.overflow = element === doc.body ? 'clip' : 'hidden';
        element.style.overscrollBehavior = 'none';
      });
      lock = {
        count: 0,
        restore: () => elements.forEach((element, index) => {
          element.style.overflow = previous[index].overflow;
          element.style.overscrollBehavior = previous[index].overscrollBehavior;
        }),
      };
      locks.set(doc, lock);
    }
    lock.count++;
    return () => {
      if (--lock.count === 0) {
        lock.restore();
        locks.delete(doc);
      }
    };
  }, [visible]);
}
