import { describe, expect, it } from 'vitest';
import { titleFit, titlePlace } from './titleFit';

describe("how a card's title fits its room", () => {
  it('stays at full size, on one line, when it fits', () => {
    expect(titleFit({ title: 300, widestWord: 200, room: 400, floor: 0.6 })).toEqual({ scale: 1, oneLine: true });
  });

  it('shrinks a name of several words to fit one line rather than wrap', () => {
    // BISHOP KEARNEY: about 70% of its size fits beside the number and count.
    expect(titleFit({ title: 525, widestWord: 270, room: 365, floor: 0.6 })).toEqual({
      scale: 365 / 525,
      oneLine: true,
    });
  });

  it('shrinks a single long word the same way', () => {
    expect(titleFit({ title: 480, widestWord: 480, room: 360, floor: 0.6 })).toEqual({ scale: 0.75, oneLine: true });
  });

  it('wraps a name too long for one line even at the smallest size, each word fitting', () => {
    // Fits on one line only under 60%: wrap at full size, since every word fits.
    expect(titleFit({ title: 900, widestWord: 300, room: 400, floor: 0.6 })).toEqual({ scale: 1, oneLine: false });
  });

  it('when wrapped, shrinks only as much as its widest word needs, never under the smallest size', () => {
    expect(titleFit({ title: 900, widestWord: 500, room: 400, floor: 0.6 })).toEqual({ scale: 0.8, oneLine: false });
    expect(titleFit({ title: 2000, widestWord: 1000, room: 400, floor: 0.6 })).toEqual({ scale: 0.6, oneLine: false });
  });
});

describe("where a card's title and Job number go", () => {
  const floor = 0.6;

  it('keeps the number beside a title that fits beside it', () => {
    expect(titlePlace({ title: 200, widestWord: 200, beside: 300, alone: 400, floor, hasNumber: true })).toEqual({
      scale: 1,
      oneLine: true,
      numberBelow: false,
    });
  });

  it('keeps the number beside a title that fits beside it once made a little smaller', () => {
    expect(titlePlace({ title: 400, widestWord: 250, beside: 300, alone: 400, floor, hasNumber: true })).toEqual({
      scale: 0.75,
      oneLine: true,
      numberBelow: false,
    });
  });

  it('puts the number under a title that only fits one line with the room to itself', () => {
    // BISHOP KEARNEY in the narrow column: 297 wide, 127 beside the number, 218 alone.
    expect(titlePlace({ title: 297, widestWord: 160, beside: 127, alone: 218, floor, hasNumber: true })).toEqual({
      scale: 218 / 297,
      oneLine: true,
      numberBelow: true,
    });
  });

  it('wraps beside the number only when even the room to itself is not enough', () => {
    expect(titlePlace({ title: 900, widestWord: 120, beside: 127, alone: 218, floor, hasNumber: true })).toEqual({
      scale: 1,
      oneLine: false,
      numberBelow: false,
    });
  });

  it('has no number to move when the Job has none: the room beside is all its own', () => {
    expect(titlePlace({ title: 297, widestWord: 160, beside: 218, alone: 218, floor, hasNumber: false })).toEqual({
      scale: 218 / 297,
      oneLine: true,
      numberBelow: false,
    });
  });
});
