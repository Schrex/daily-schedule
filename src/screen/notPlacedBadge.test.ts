import { describe, expect, it } from 'vitest';
import { badgeTap, badgeWords, listShown, staysOpen } from './notPlacedBadge';

describe('the Not Placed badge on a phone', () => {
  it('says how the list is opened and closed while someone is Not Placed', () => {
    expect(badgeWords({ notPlaced: 3, open: false })).toEqual({ label: 'Not placed yet', does: 'Show' });
    expect(badgeWords({ notPlaced: 3, open: true })).toEqual({ label: 'Not placed yet', does: 'Close' });
  });

  it('says so when nobody is Not Placed, and offers nothing to open', () => {
    expect(badgeWords({ notPlaced: 0, open: false })).toEqual({ label: 'Everyone is placed', does: null });
    expect(badgeWords({ notPlaced: 0, open: true })).toEqual({ label: 'Everyone is placed', does: null });
  });

  it('names whoever was picked up from the list, and offers to put them back', () => {
    expect(badgeWords({ notPlaced: 3, open: true, moving: 'Brody' })).toEqual({
      label: 'Moving Brody',
      does: 'Put back',
    });
  });
});

describe('a tap on the badge', () => {
  it('opens the list, and closes it again', () => {
    expect(badgeTap({ notPlaced: 2, open: false })).toBe('open');
    expect(badgeTap({ notPlaced: 2, open: true })).toBe('close');
  });

  it('puts back whoever was picked up from the list, open or not', () => {
    expect(badgeTap({ notPlaced: 2, open: true, moving: 'Brody' })).toBe('put-back');
    expect(badgeTap({ notPlaced: 2, open: false, moving: 'Brody' })).toBe('put-back');
  });

  it('does nothing with nobody Not Placed', () => {
    expect(badgeTap({ notPlaced: 0, open: false })).toBe('nothing');
  });
});

describe('the open list', () => {
  it('is over the board only while it is open', () => {
    expect(listShown(true, false)).toBe(true);
    expect(listShown(false, false)).toBe(false);
  });

  it('steps aside while a name is in hand, so the places under it can be reached', () => {
    expect(listShown(true, true)).toBe(false);
  });

  it('stays open from one name to the next, and closes with the last one placed', () => {
    expect(staysOpen(true, 2)).toBe(true);
    expect(staysOpen(true, 0)).toBe(false);
    expect(staysOpen(false, 2)).toBe(false);
  });
});
