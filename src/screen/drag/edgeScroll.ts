/**
 * The schedule can be taller than the window, so a Job or Standing Row may be
 * out of sight when a name is picked up. Holding the dragged name near the top
 * or bottom edge of a scrolling area scrolls it, so every destination can be
 * reached without letting go.
 */

/** How close (CSS pixels) to an edge the pointer must be for the area to scroll. */
export const EDGE_ZONE = 70;

/** The fastest it scrolls, in CSS pixels per frame. Quick, but a row can still be caught. */
export const MAX_SCROLL_SPEED = 14;

/**
 * How far to scroll this frame for a pointer at height `y`, in an area whose
 * visible part runs from `top` to `bottom`: negative is up, 0 is not at all.
 * It speeds up towards the edge and holds full speed at the edge and past it.
 */
export function edgeScrollSpeed(y: number, top: number, bottom: number): number {
  const zone = Math.min(EDGE_ZONE, (bottom - top) / 2);
  if (zone <= 0) return 0;
  const intoTop = top + zone - y;
  const intoBottom = y - (bottom - zone);
  const depth = Math.max(intoTop, intoBottom);
  if (depth <= 0) return 0;
  const speed = Math.ceil(MAX_SCROLL_SPEED * Math.min(1, depth / zone));
  return intoBottom > intoTop ? speed : -speed;
}

/** The areas that scroll up and down and hold a destination (an element marked `data-drop`). */
function scrollingAreas(): HTMLElement[] {
  const areas = new Set<HTMLElement>();
  for (const drop of document.querySelectorAll<HTMLElement>('[data-drop]')) {
    for (let area = drop.parentElement; area && area !== document.body; area = area.parentElement) {
      const scrolls = /auto|scroll/.test(getComputedStyle(area).overflowY);
      if (scrolls && area.scrollHeight > area.clientHeight) areas.add(area);
    }
  }
  return [...areas];
}

/**
 * Scrolls, frame by frame, whichever scrolling area the pointer is held at the
 * edge of, until stopped. `pointer` is asked each frame; `onScrolled` is told
 * when something moved (what is under a still pointer has changed).
 * Returns the function that stops it.
 */
export function startEdgeScroll(
  pointer: () => { x: number; y: number },
  onScrolled: () => void,
): () => void {
  const areas = scrollingAreas();
  let frame = 0;
  const step = () => {
    const { x, y } = pointer();
    for (const area of areas) {
      const box = area.getBoundingClientRect();
      if (x < box.left || x > box.right) continue;
      const speed = edgeScrollSpeed(y, box.top, box.bottom);
      if (speed === 0) continue;
      const before = area.scrollTop;
      area.scrollTop = before + speed;
      if (area.scrollTop !== before) onScrolled();
    }
    frame = requestAnimationFrame(step);
  };
  if (areas.length > 0) frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
