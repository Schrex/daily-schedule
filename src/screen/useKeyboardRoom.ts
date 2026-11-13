import { useEffect, type RefObject } from 'react';
import { keyboardRoom, noKeyboard } from './keyboardRoom';

/** A field the keyboard types into. */
const typingIn = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'file'].includes(element.type));

/** The field being typed in, with its buttons, brought to the middle of what can be seen. */
function showField() {
  const field = document.activeElement;
  if (!typingIn(field)) return;
  (field.closest<HTMLElement>('.line-editor, .tasks-editing') ?? field).scrollIntoView({ block: 'center' });
}

/**
 * While a phone's keyboard is up (`keyboardRoom`), marks the screen
 * `data-keyboard="up"` and tells it what is left of the window above the
 * keyboard (`--window-top`, `--window-height`), so the screen is exactly that
 * and the field being typed in is in sight. The mark and the two sizes are
 * put straight on the element: the keyboard coming and going redraws nothing.
 *
 * An iPhone does not make the window shorter for its keyboard: it slides the
 * page up under it, which leaves a screen that fills the window half hidden
 * and its bars in the wrong place. What can be seen (`visualViewport`) is the
 * same measure on every phone.
 */
export function useKeyboardRoom(screen: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const seen = window.visualViewport;
    if (!seen) return;
    // What can be seen, as it is with no pinch-zoom.
    const size = () => ({
      width: Math.round(seen.width * seen.scale),
      height: Math.round(seen.height * seen.scale),
    });
    let room = noKeyboard(size());

    const look = () => {
      const element = screen.current;
      if (!element) return;
      const wasUp = room.up;
      room = keyboardRoom(room, { ...size(), typing: typingIn(document.activeElement) });
      if (room.up) {
        element.dataset.keyboard = 'up';
        element.style.setProperty('--window-top', `${seen.offsetTop}px`);
        element.style.setProperty('--window-height', `${seen.height}px`);
      } else {
        delete element.dataset.keyboard;
        element.style.removeProperty('--window-top');
        element.style.removeProperty('--window-height');
      }
      if (room.up && !wasUp) showField();
    };
    /** Another field took the keyboard while it was up. */
    const onFocus = () => {
      look();
      if (room.up) requestAnimationFrame(showField);
    };

    seen.addEventListener('resize', look);
    seen.addEventListener('scroll', look);
    document.addEventListener('focusin', onFocus);
    return () => {
      seen.removeEventListener('resize', look);
      seen.removeEventListener('scroll', look);
      document.removeEventListener('focusin', onFocus);
    };
  }, [screen]);
}
