import { describe, expect, it } from 'vitest';
import { EDGE_ZONE, MAX_SCROLL_SPEED, edgeScrollSpeed } from './edgeScroll';

// A scrolling area whose visible part runs from y = 200 down to y = 600.
const speedAt = (y: number) => edgeScrollSpeed(y, 200, 600);

describe('scrolling the schedule while a name is dragged near its edge', () => {
  it('does not scroll while the pointer is well inside', () => {
    expect(speedAt(400)).toBe(0);
    expect(speedAt(200 + EDGE_ZONE)).toBe(0);
    expect(speedAt(600 - EDGE_ZONE)).toBe(0);
  });

  it('scrolls down near the bottom edge, faster the closer the pointer is to it', () => {
    const justInside = speedAt(600 - EDGE_ZONE + 10);
    const nearlyThere = speedAt(600 - 10);

    expect(justInside).toBeGreaterThan(0);
    expect(nearlyThere).toBeGreaterThan(justInside);
  });

  it('scrolls up near the top edge, faster the closer the pointer is to it', () => {
    const justInside = speedAt(200 + EDGE_ZONE - 10);
    const nearlyThere = speedAt(200 + 10);

    expect(justInside).toBeLessThan(0);
    expect(nearlyThere).toBeLessThan(justInside);
  });

  it('scrolls at full speed, and no faster, at the edge and beyond it', () => {
    expect(speedAt(600)).toBe(MAX_SCROLL_SPEED);
    expect(speedAt(750)).toBe(MAX_SCROLL_SPEED);
    expect(speedAt(200)).toBe(-MAX_SCROLL_SPEED);
    expect(speedAt(20)).toBe(-MAX_SCROLL_SPEED);
  });

  it('halves the zones of an area too short to hold both', () => {
    // 60px tall: the middle is still, each half scrolls its own way.
    expect(edgeScrollSpeed(130, 100, 160)).toBe(0);
    expect(edgeScrollSpeed(110, 100, 160)).toBeLessThan(0);
    expect(edgeScrollSpeed(150, 100, 160)).toBeGreaterThan(0);
  });
});
