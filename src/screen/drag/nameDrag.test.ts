import { describe, expect, it } from 'vitest';
import {
  cancel,
  DOUBLE_CLICK_INTERVAL,
  DRAG_THRESHOLD,
  idle,
  moveTo,
  press,
  release,
  shakyDoubleClick,
  type Press,
} from './nameDrag';

const at = (x: number, y: number) => ({ x, y });

describe('dragging a name', () => {
  it('is not a drag while the pointer stays near where it was pressed, so a click stays a click', () => {
    const pressed = press('bob', at(100, 100));
    const nudged = moveTo(pressed, at(100 + DRAG_THRESHOLD - 1, 100), 'job:1');

    expect(nudged.kind).toBe('pressed');
    expect(release(nudged)).toBeNull();
  });

  it('becomes a drag once the pointer has moved the threshold away, in any direction', () => {
    const pressed = press('bob', at(100, 100));

    expect(moveTo(pressed, at(100, 100 - DRAG_THRESHOLD), null)).toEqual({
      kind: 'dragging',
      crewMemberId: 'bob',
      over: null,
    });
    expect(moveTo(pressed, at(104, 105), null).kind).toBe('dragging');
  });

  it('stays a drag when the pointer comes back to where it was pressed', () => {
    const dragging = moveTo(press('bob', at(100, 100)), at(300, 300), 'job:1');

    expect(moveTo(dragging, at(100, 100), 'job:2')).toEqual({
      kind: 'dragging',
      crewMemberId: 'bob',
      over: 'job:2',
    });
  });

  it('drops the Crew Member on the destination under the pointer at release', () => {
    let drag = press('bob', at(100, 100));
    drag = moveTo(drag, at(200, 200), 'job:1');
    drag = moveTo(drag, at(400, 300), 'not-placed');

    expect(release(drag)).toEqual({ crewMemberId: 'bob', over: 'not-placed' });
  });

  it('drops nothing when released outside any destination', () => {
    let drag = press('bob', at(100, 100));
    drag = moveTo(drag, at(200, 200), 'job:1');
    drag = moveTo(drag, at(900, 5), null);

    expect(release(drag)).toBeNull();
  });

  it('drops nothing once cancelled, whatever the pointer does next', () => {
    const dragging = moveTo(press('bob', at(100, 100)), at(200, 200), 'job:1');
    const cancelled = cancel(dragging);

    expect(cancelled).toBe(idle);
    expect(moveTo(cancelled, at(300, 300), 'job:2')).toBe(idle);
    expect(release(cancelled)).toBeNull();
  });
});

describe('a double-click made with a shaky hand', () => {
  /** A steady click on Bob's name, on Job 1, at time 1000. */
  const click: Press = {
    crewMemberId: 'bob',
    home: 'job:1',
    letGoOver: 'job:1',
    downAt: 1000,
    upAt: 1080,
    dragged: false,
  };
  /** A second press soon after, during which the pointer slipped far enough to be a drag. */
  const slipped: Press = { ...click, downAt: 1200, upAt: 1300, dragged: true };

  it("counts a quick second press that slipped into a drag but ended on the name's own row", () => {
    expect(shakyDoubleClick(click, slipped)).toBe(true);
  });

  it('counts it when the first press was the one that slipped', () => {
    const first: Press = { ...click, dragged: true };
    const second: Press = { ...click, downAt: 1200, upAt: 1300 };

    expect(shakyDoubleClick(first, second)).toBe(true);
  });

  it('leaves two steady clicks to the browser, which reports that double-click itself', () => {
    expect(shakyDoubleClick(click, { ...slipped, dragged: false })).toBe(false);
  });

  it('is not one without a click just before, or after a click on another name', () => {
    expect(shakyDoubleClick(null, slipped)).toBe(false);
    expect(shakyDoubleClick({ ...click, crewMemberId: 'ann' }, slipped)).toBe(false);
  });

  it('is not one when the name was let go on another row, or on none: that is a real drag', () => {
    expect(shakyDoubleClick(click, { ...slipped, letGoOver: 'job:2' })).toBe(false);
    expect(shakyDoubleClick(click, { ...slipped, letGoOver: null })).toBe(false);
    expect(shakyDoubleClick({ ...click, dragged: true, letGoOver: 'job:2' }, slipped)).toBe(false);
  });

  it('is not one when the second press comes too late', () => {
    const justInTime = click.downAt + DOUBLE_CLICK_INTERVAL;

    expect(shakyDoubleClick(click, { ...slipped, downAt: justInTime, upAt: justInTime + 100 })).toBe(true);
    expect(
      shakyDoubleClick(click, { ...slipped, downAt: justInTime + 1, upAt: justInTime + 101 }),
    ).toBe(false);
  });

  it('is not one when either press was held: a name picked up and put back is a drag', () => {
    const tooLong = DOUBLE_CLICK_INTERVAL + 1;

    expect(shakyDoubleClick(click, { ...slipped, upAt: slipped.downAt + tooLong })).toBe(false);
    expect(shakyDoubleClick({ ...click, upAt: click.downAt + tooLong }, slipped)).toBe(false);
  });
});
