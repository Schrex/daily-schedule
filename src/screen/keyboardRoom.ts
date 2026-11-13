/**
 * On a phone the keyboard takes the lower half of the screen. This says
 * whether it is up, from how much of the window can be seen; the screen then
 * fits what is left above it (`useKeyboardRoom`) and only a narrow screen's
 * CSS acts on it.
 *
 * A phone does not say "the keyboard is up". What can be seen of the window
 * only gets shorter: on some browsers the window itself, on others only the
 * part of it in sight. Either way it is the same measure here.
 */

/** What can be seen of the window, in pixels, and whether a field has the keyboard's attention. */
export interface WindowSeen {
  width: number;
  height: number;
  /** A text field has the focus. */
  typing: boolean;
}

export interface KeyboardRoom {
  /** The keyboard is up. */
  up: boolean;
  /** The width this was measured at: a phone turned on its side starts again. */
  width: number;
  /** The tallest the window has been seen at this width: what it is with no keyboard. */
  tallest: number;
}

/**
 * A keyboard takes far more than this; a browser's own bars sliding in and
 * out take less.
 */
const KEYBOARD_TAKES = 150;

export const noKeyboard = ({ width, height }: Pick<WindowSeen, 'width' | 'height'>): KeyboardRoom => ({
  up: false,
  width,
  tallest: height,
});

/**
 * Whether the keyboard is up, given what was known. It comes up only while a
 * field is being typed in (so a window dragged shorter is not a keyboard), and
 * is up until the window is tall again: a tap on "Add task" leaves the field
 * a moment before the keyboard goes, and the button must not move from under
 * the finger.
 */
export function keyboardRoom(was: KeyboardRoom, seen: WindowSeen): KeyboardRoom {
  if (seen.width !== was.width) return noKeyboard(seen);
  const tallest = Math.max(was.tallest, seen.height);
  const taken = tallest - seen.height > KEYBOARD_TAKES;
  return { up: taken && (was.up || seen.typing), width: seen.width, tallest };
}
