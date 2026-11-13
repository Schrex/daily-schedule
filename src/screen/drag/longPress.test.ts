import { describe, expect, it } from 'vitest';
import { fingerDown, fingerHeld, fingerLost, fingerMoved, fingerUp, liftsIn } from './longPress';

const at = (x: number, y: number) => ({ x, y });

describe('a finger on a name', () => {
  it('is a scroll once it has moved more than 8 px before the lift, and picks nothing up', () => {
    const down = fingerDown(at(100, 100), 1000);
    const moved = fingerMoved(down, at(100, 109));

    expect(moved.kind).toBe('scroll');
    // Holding on after that does not lift the name: the page is scrolling.
    expect(fingerHeld(moved, 2000).kind).toBe('scroll');
  });

  it('is still held while it only trembles, up to 8 px in any direction', () => {
    const down = fingerDown(at(100, 100), 1000);

    expect(fingerMoved(down, at(108, 100)).kind).toBe('holding');
    expect(fingerMoved(down, at(95, 94)).kind).toBe('holding');
    expect(fingerMoved(down, at(94, 94)).kind).toBe('scroll');
  });

  it('lifts the name once it has been held still for 350 ms', () => {
    const down = fingerDown(at(100, 100), 1000);

    expect(fingerHeld(down, 1349).kind).toBe('holding');
    expect(fingerHeld(down, 1350).kind).toBe('lifted');
  });

  it('says how long is left before the lift', () => {
    const down = fingerDown(at(100, 100), 1000);

    expect(liftsIn(down, 1000)).toBe(350);
    expect(liftsIn(down, 1300)).toBe(50);
    expect(liftsIn(down, 1400)).toBe(0);
  });

  it('stays lifted wherever it goes afterwards: from then on it is a drag, not a scroll', () => {
    const lifted = fingerHeld(fingerDown(at(100, 100), 1000), 1350);

    expect(fingerMoved(lifted, at(100, 400)).kind).toBe('lifted');
    expect(fingerUp(lifted).kind).toBe('lifted');
  });

  it('is a tap when it comes up before the lift, so the click goes ahead', () => {
    const down = fingerDown(at(100, 100), 1000);
    const up = fingerUp(fingerMoved(down, at(102, 101)));

    expect(up.kind).toBe('tap');
    expect(fingerHeld(up, 2000).kind).toBe('tap');
  });

  it('is not a tap when it comes up after scrolling', () => {
    const scrolled = fingerMoved(fingerDown(at(100, 100), 1000), at(100, 160));

    expect(fingerUp(scrolled).kind).toBe('scroll');
  });

  it('lifts nothing once it is lost before the lift: the page scrolled, or the touch was taken away', () => {
    const lost = fingerLost(fingerDown(at(100, 100), 1000));

    expect(lost.kind).toBe('off');
    expect(fingerHeld(lost, 2000).kind).toBe('off');
    expect(fingerMoved(lost, at(100, 100)).kind).toBe('off');
  });
});
