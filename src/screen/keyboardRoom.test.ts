import { describe, expect, it } from 'vitest';
import { keyboardRoom, noKeyboard } from './keyboardRoom';

const phone = noKeyboard({ width: 393, height: 740 });

describe('keyboardRoom', () => {
  it('is up when the window gets much shorter while a field is typed in', () => {
    expect(keyboardRoom(phone, { width: 393, height: 400, typing: true }).up).toBe(true);
  });

  it('is not up when the window gets shorter with no field in use', () => {
    expect(keyboardRoom(phone, { width: 393, height: 400, typing: false }).up).toBe(false);
  });

  it("is not up for the browser's own bars sliding in", () => {
    expect(keyboardRoom(phone, { width: 393, height: 660, typing: true }).up).toBe(false);
  });

  it('stays up after the field is left, until the window is tall again', () => {
    const up = keyboardRoom(phone, { width: 393, height: 400, typing: true });
    const left = keyboardRoom(up, { width: 393, height: 400, typing: false });
    expect(left.up).toBe(true);
    expect(keyboardRoom(left, { width: 393, height: 740, typing: false }).up).toBe(false);
  });

  it('learns how tall the window is when it grows', () => {
    const short = noKeyboard({ width: 393, height: 660 });
    const grown = keyboardRoom(short, { width: 393, height: 740, typing: false });
    expect(grown.tallest).toBe(740);
    expect(keyboardRoom(grown, { width: 393, height: 560, typing: true }).up).toBe(true);
  });

  it('starts again when the phone is turned on its side', () => {
    const up = keyboardRoom(phone, { width: 393, height: 400, typing: true });
    expect(keyboardRoom(up, { width: 740, height: 393, typing: true })).toEqual({
      up: false,
      width: 740,
      tallest: 393,
    });
  });
});
