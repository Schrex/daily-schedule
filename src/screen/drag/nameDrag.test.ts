import { describe, expect, it } from 'vitest';
import {
  cancel,
  DRAG_THRESHOLD,
  idle,
  lift,
  moveTo,
  press,
  release,
  spotAt,
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
      before: null,
    });
    expect(moveTo(pressed, at(104, 105), null).kind).toBe('dragging');
  });

  it('stays a drag when the pointer comes back to where it was pressed', () => {
    const dragging = moveTo(press('bob', at(100, 100)), at(300, 300), 'job:1');

    expect(moveTo(dragging, at(100, 100), 'job:2')).toEqual({
      kind: 'dragging',
      crewMemberId: 'bob',
      over: 'job:2',
      before: null,
    });
  });

  it('drops the Crew Member on the destination under the pointer at release', () => {
    let drag = press('bob', at(100, 100));
    drag = moveTo(drag, at(200, 200), 'job:1');
    drag = moveTo(drag, at(400, 300), 'not-placed');

    expect(release(drag)).toEqual({ crewMemberId: 'bob', over: 'not-placed', before: null });
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

describe('lifting a name held under a finger', () => {
  it('is a drag at once, without the pointer having moved, over the destination the name is in', () => {
    const lifted = lift(press('bob', at(100, 100)), 'job:1', 'ann');

    expect(lifted).toEqual({ kind: 'dragging', crewMemberId: 'bob', over: 'job:1', before: 'ann' });
    expect(release(lifted)).toEqual({ crewMemberId: 'bob', over: 'job:1', before: 'ann' });
  });

  it('lifts nothing when no name is pressed', () => {
    expect(lift(idle, 'job:1', null)).toBe(idle);
  });
});

describe('the spot in a row a name is held at', () => {
  it('drops the Crew Member just before the name the pointer was let go above', () => {
    let drag = press('bob', at(100, 100));
    drag = moveTo(drag, at(200, 200), 'job:1', null);
    drag = moveTo(drag, at(200, 180), 'job:1', 'ann');

    expect(drag).toEqual({ kind: 'dragging', crewMemberId: 'bob', over: 'job:1', before: 'ann' });
    expect(release(drag)).toEqual({ crewMemberId: 'bob', over: 'job:1', before: 'ann' });
  });

  it('is the same drag, not a new one, while neither the destination nor the spot changes', () => {
    const drag = moveTo(press('bob', at(100, 100)), at(200, 200), 'job:1', 'ann');

    expect(moveTo(drag, at(210, 202), 'job:1', 'ann')).toBe(drag);
  });

  // Three names one under another, 30px tall: Ann 0-30, Bob 30-60, Cal 60-90.
  const names = [
    { crewMemberId: 'ann', top: 0, bottom: 30 },
    { crewMemberId: 'bob', top: 30, bottom: 60 },
    { crewMemberId: 'cal', top: 60, bottom: 90 },
  ];

  it('is just before the first name whose middle is below the pointer', () => {
    expect(spotAt(-20, names, 'zed')).toBe('ann');
    expect(spotAt(14, names, 'zed')).toBe('ann');
    expect(spotAt(16, names, 'zed')).toBe('bob');
    expect(spotAt(74, names, 'zed')).toBe('cal');
  });

  it('is the end of the row below the middle of the last name', () => {
    expect(spotAt(76, names, 'zed')).toBeNull();
    expect(spotAt(500, names, 'zed')).toBeNull();
    expect(spotAt(10, [], 'zed')).toBeNull();
  });

  it("ignores the dragged name's own chip", () => {
    expect(spotAt(40, names, 'bob')).toBe('cal');
    expect(spotAt(80, names, 'cal')).toBeNull();
  });

  it('stays put when the names make room under a pointer that has not moved', () => {
    // Held at y=40 between Ann and Cal: before Cal. Bob (the dragged name) is
    // then drawn there and pushes Cal down; the spot is still before Cal.
    expect(spotAt(40, [names[0]!, { crewMemberId: 'cal', top: 30, bottom: 60 }], 'bob')).toBe('cal');
    const madeRoom = [names[0]!, { crewMemberId: 'bob', top: 30, bottom: 60 }, { crewMemberId: 'cal', top: 60, bottom: 90 }];
    expect(spotAt(40, madeRoom, 'bob')).toBe('cal');
  });
});
