import { describe, expect, it } from 'vitest';
import { collapsedDate, headerCollapsed } from './headerCollapse';

describe('the header on a phone', () => {
  it('is open at the top of the board', () => {
    expect(headerCollapsed(false, { scrolled: 0, room: 2000 })).toBe(false);
  });

  it('collapses once the board has scrolled', () => {
    expect(headerCollapsed(false, { scrolled: 60, room: 2000 })).toBe(true);
  });

  it('stays open for a nudge', () => {
    expect(headerCollapsed(false, { scrolled: 10, room: 2000 })).toBe(false);
  });

  it('stays collapsed on the way back up, until the top', () => {
    expect(headerCollapsed(true, { scrolled: 10, room: 2000 })).toBe(true);
    expect(headerCollapsed(true, { scrolled: 0, room: 2000 })).toBe(false);
  });

  it('opens when the board bounces past the top', () => {
    expect(headerCollapsed(true, { scrolled: -12, room: 2000 })).toBe(false);
  });

  it('stays open on a board too short to need the room: collapsing would leave nothing to scroll', () => {
    expect(headerCollapsed(false, { scrolled: 60, room: 120 })).toBe(false);
  });
});

describe('the date in the collapsed header', () => {
  it('is short enough for one line beside the buttons', () => {
    expect(collapsedDate('2026-11-13')).toBe('Fri, Nov 13');
    expect(collapsedDate('2027-01-01')).toBe('Fri, Jan 1');
  });
});
