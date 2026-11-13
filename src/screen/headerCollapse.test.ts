import { describe, expect, it } from 'vitest';
import { headerCollapsed, sceneOnScreen } from './headerCollapse';

describe('the header on a phone', () => {
  it('is open at the top of the board', () => {
    expect(headerCollapsed(false, { scrolled: 0, room: 2000, header: 190 })).toBe(false);
  });

  it('collapses once the board has scrolled', () => {
    expect(headerCollapsed(false, { scrolled: 60, room: 2000, header: 190 })).toBe(true);
  });

  it('stays open for a nudge', () => {
    expect(headerCollapsed(false, { scrolled: 10, room: 2000, header: 190 })).toBe(false);
  });

  it('stays collapsed on the way back up, until the top', () => {
    expect(headerCollapsed(true, { scrolled: 10, room: 2000, header: 190 })).toBe(true);
    expect(headerCollapsed(true, { scrolled: 0, room: 2000, header: 190 })).toBe(false);
  });

  it('opens when the board bounces past the top', () => {
    expect(headerCollapsed(true, { scrolled: -12, room: 2000, header: 190 })).toBe(false);
  });

  it('collapses on a short board scrolled to its end, as after a jump to Off Work', () => {
    expect(headerCollapsed(false, { scrolled: 250, room: 250, header: 190 })).toBe(true);
  });

  it('stays open on a board so short that the collapsed header would leave nothing to scroll', () => {
    // An open header 190 tall gives the board up to 150 when it collapses.
    expect(headerCollapsed(false, { scrolled: 60, room: 120, header: 190 })).toBe(false);
    expect(headerCollapsed(false, { scrolled: 150, room: 150, header: 190 })).toBe(false);
  });

  it('does not open again by itself: once collapsed, the board is still scrolled', () => {
    // The least room it collapses with, 151: the board keeps at least 1 to scroll, and so stays scrolled.
    expect(headerCollapsed(false, { scrolled: 151, room: 151, header: 190 })).toBe(true);
    expect(headerCollapsed(true, { scrolled: 1, room: 1, header: 190 })).toBe(true);
  });
});

describe('what is on the screen, for the travelling names', () => {
  it('is another scene when the header collapses or opens, so no name travels for it', () => {
    expect(sceneOnScreen('2026-11-16', true)).not.toBe(sceneOnScreen('2026-11-16', false));
  });

  it('is another scene on another date, and the same one otherwise', () => {
    expect(sceneOnScreen('2026-11-16', false)).not.toBe(sceneOnScreen('2026-11-17', false));
    expect(sceneOnScreen('2026-11-16', true)).toBe(sceneOnScreen('2026-11-16', true));
  });
});
