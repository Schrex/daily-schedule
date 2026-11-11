import { describe, expect, it } from 'vitest';
import {
  cancel,
  DRAG_THRESHOLD,
  idle,
  moveTo,
  press,
  release,
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
