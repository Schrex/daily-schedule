import { describe, expect, it } from 'vitest';
import { cssTimeMs, nameMove, type Seen } from './nameMove';

const table = 'the table';
const notPlacedList = 'the Not Placed list';

const seen = (x: number, y: number, area: unknown = table, width = 120, height = 40): Seen => ({
  x,
  y,
  width,
  height,
  area,
});

describe('how a name gets from where it was seen to where it is now', () => {
  it('slides a name that moved within the same area, starting from where it was', () => {
    expect(nameMove(seen(100, 50), seen(260, 110))).toEqual({ kind: 'slide', dx: -160, dy: -60 });
  });

  it('leaves alone a name that has not moved, or by less than can be seen', () => {
    expect(nameMove(seen(100, 50), seen(100, 50))).toEqual({ kind: 'stay' });
    expect(nameMove(seen(100, 50), seen(100.4, 49.7))).toEqual({ kind: 'stay' });
  });

  it('leaves alone a name that was not on the screen before', () => {
    expect(nameMove(undefined, seen(100, 50))).toEqual({ kind: 'stay' });
  });

  it('flies a name that went from one area to another, since it could not be seen crossing inside either', () => {
    expect(nameMove(seen(900, 300, notPlacedList), seen(260, 110, table))).toEqual({
      kind: 'fly',
      dx: 640,
      dy: 190,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('flies a name last seen in no area (lifted by a drag), from the size it was seen at', () => {
    const lifted = seen(500, 400, null, 126, 42);

    expect(nameMove(lifted, seen(260, 110, table, 120, 40))).toEqual({
      kind: 'fly',
      dx: 240,
      dy: 290,
      scaleX: 1.05,
      scaleY: 1.05,
    });
  });

  it('flies a lifted name home even when it is let go exactly over its place', () => {
    expect(nameMove(seen(260, 110, null), seen(260, 110, table)).kind).toBe('fly');
  });
});

describe('a CSS time in milliseconds', () => {
  it('reads milliseconds as written in the look', () => {
    expect(cssTimeMs('300ms')).toBe(300);
    expect(cssTimeMs(' 300ms ')).toBe(300);
  });

  it('reads seconds, as the production build rewrites them', () => {
    expect(cssTimeMs('.3s')).toBe(300);
    expect(cssTimeMs('0.25s')).toBe(250);
    expect(cssTimeMs('0s')).toBe(0);
  });

  it('is no time at all when there is none, or it cannot be read', () => {
    expect(cssTimeMs('')).toBe(0);
    expect(cssTimeMs('fast')).toBe(0);
  });
});
