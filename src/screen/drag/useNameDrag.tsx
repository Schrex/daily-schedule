import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  cancel,
  idle,
  lift,
  moveTo,
  press,
  release,
  spotAt,
  type DropKey,
  type NameDrag,
  type Point,
} from './nameDrag';
import { fingerDown, fingerHeld, fingerLost, fingerMoved, fingerUp, liftsIn, type Finger } from './longPress';
import { startEdgeScroll } from './edgeScroll';
import './drag.css';

/**
 * Dragging a Crew Member's name, built on pointer events (not the browser's
 * own drag and drop, which gives no say over what is drawn under the
 * pointer). It knows names and destinations only by the marks put on them
 * (`nameProps`, `dropProps`) and applies no schedule rule: on a drop it reports
 * who was let go over which destination, and that is all.
 *
 * With the mouse or a pen, a press is a drag once the pointer has moved a few
 * pixels (see `nameDrag`), so a click still selects.
 *
 * With a finger, a press is a drag only once the finger has been held still on
 * the name for a moment (see `longPress`): a finger that moves straight away is
 * scrolling the page, and one that comes up straight away is a tap. From the
 * lift on, it is the same drag as the mouse's.
 */

/**
 * How far above the fingertip (CSS pixels) the lifted copy is drawn, so the
 * finger does not hide it or the gap the names open under it.
 */
const ABOVE_THE_FINGER = 40;

/**
 * How long after a finger comes up (milliseconds) its click may still arrive.
 * A mouse's click comes in the same turn as the release; a finger's comes a
 * little later.
 */
const FINGER_CLICK_WITHIN = 400;

const nothing = () => {};

/** The name being dragged right now, the destination under the pointer, and the spot in it. */
export interface Dragging {
  crewMemberId: string;
  over: DropKey | null;
  /** Just before this Crew Member in the destination, or null for its end. */
  before: string | null;
}

export interface NameDragOptions {
  /** The name as it is drawn on the board, for the lifted copy that follows the pointer. */
  drawLifted: (crewMemberId: string) => ReactNode;
  /**
   * A name was let go over a destination, at a spot in it (just before
   * `before`, or the end when null). Not called for a drop outside one, or after Escape.
   */
  onDrop: (crewMemberId: string, over: DropKey, before: string | null) => void;
  /**
   * A drag ended, by a drop or not: where in the window the lifted copy was at
   * that instant, for whoever shows the name going from there to its place.
   * Called before `onDrop`.
   */
  onLetGo?: (crewMemberId: string, liftedAt: DOMRect) => void;
}

export interface NameDragHandle {
  /** Null unless a drag is under way. */
  dragging: Dragging | null;
  /** Spread on the element that is a Crew Member's name. */
  nameProps: (crewMemberId: string) => {
    'data-crew-member': string;
    'data-dragging': true | undefined;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  };
  /** Spread on an element that is a destination: anywhere inside it is a drop there. */
  dropProps: (key: DropKey) => { 'data-drop': DropKey; 'data-drop-over': true | undefined };
  /** The lifted copy of the name, following the pointer. Draw it anywhere; it is null when idle. */
  overlay: ReactNode;
}

/**
 * While a name is dragged the page under it is redrawn (the names make room
 * where it would land), which may take away the very element that was pressed.
 * So the pointer is held by the page itself, which is always there.
 */
const pointerHolder = () => document.body;

/**
 * Keeps every destination at least as tall as it is now, until the function
 * returned is called. A destination that lost the dragged name would otherwise
 * shrink, and pull the others out from under a pointer that has not moved.
 */
function holdDestinationHeights(): () => void {
  // A destination marked data-drop-grows (a folded Job) is meant to grow when a
  // name is picked up, exactly as when one is selected: it is not held.
  const held = [...document.querySelectorAll<HTMLElement>('[data-drop]:not([data-drop-grows])')].map((destination) => {
    const before = destination.style.minHeight;
    return { destination, before, height: destination.getBoundingClientRect().height };
  });
  for (const { destination, height } of held) destination.style.minHeight = `${height}px`;
  return () => {
    for (const { destination, before } of held) destination.style.minHeight = before;
  };
}

/**
 * The destination under a point of the window, if any, and the spot in it by
 * the pointer's height against the names drawn there (`spotAt`). The lifted
 * copy never counts: it lets the pointer through.
 */
function whereAt(point: Point, dragged: string): { over: DropKey | null; before: string | null } {
  const under = document.elementFromPoint(point.x, point.y);
  const destination = under?.closest<HTMLElement>('[data-drop]');
  if (!destination) return { over: null, before: null };
  const names = [...destination.querySelectorAll<HTMLElement>('[data-crew-member]')].map((name) => {
    const box = name.getBoundingClientRect();
    // Where the page puts the name, not where a slide making room has it this
    // instant: measured mid-slide, the spot would flick back and forth.
    const shift = new DOMMatrixReadOnly(getComputedStyle(name).transform).m42;
    return { crewMemberId: name.dataset.crewMember ?? '', top: box.top - shift, bottom: box.bottom - shift };
  });
  return { over: destination.dataset.drop ?? null, before: spotAt(point.y, names, dragged) };
}

/** The drag taken to where the pointer is now. */
function moveToPointer(drag: NameDrag, point: Point): NameDrag {
  if (drag.kind === 'idle') return drag;
  const { over, before } = whereAt(point, drag.crewMemberId);
  return moveTo(drag, point, over, before);
}

/**
 * The browser follows a press and release with a click. After a drag that
 * click is not one the Scheduler made: it must not select a name or pick a
 * destination. This swallows it, whether the drag ended in a drop or was
 * cancelled with the button still down, and then stops listening. It listens
 * until `within` milliseconds after the release.
 */
function swallowNextClick(within = 0): void {
  const swallow = (click: MouseEvent) => {
    click.stopPropagation();
    click.preventDefault();
  };
  const stop = () => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerup', stopSoon, true);
    window.removeEventListener('pointerdown', stop, true);
  };
  // The click comes right after the release, in the same turn: listen just past it.
  const stopSoon = () => setTimeout(stop, within);
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerup', stopSoon, true);
  window.addEventListener('pointerdown', stop, true);
}

export function useNameDrag({
  drawLifted,
  onDrop,
  onLetGo,
}: NameDragOptions): NameDragHandle {
  const [dragging, setDragging] = useState<Dragging | null>(null);
  /** How wide the name was when it was lifted: the copy is drawn as wide. */
  const [liftedWidth, setLiftedWidth] = useState<number | null>(null);

  /** The drag as it stands this instant; state only catches up at the next draw. */
  const drag = useRef<NameDrag>(idle);
  const pointer = useRef<Point>({ x: 0, y: 0 });
  /** From the lifted name's top left corner to where the pointer took hold of it. */
  const grip = useRef<Point>({ x: 0, y: 0 });
  const overlayElement = useRef<HTMLElement | null>(null);
  /** Ends the listening begun by the press that is under way, if any. */
  const stopListening = useRef<() => void>(() => {});
  const onDropLatest = useRef(onDrop);
  onDropLatest.current = onDrop;
  const onLetGoLatest = useRef(onLetGo);
  onLetGoLatest.current = onLetGo;
  /** Whether the last press on a name was a finger's: its long press must not open a menu. */
  const pressedByFinger = useRef(false);

  /** Puts the lifted copy under the pointer, held where it was taken hold of. No redraw. */
  const follow = () => {
    const element = overlayElement.current;
    if (!element) return;
    const x = pointer.current.x - grip.current.x;
    const y = pointer.current.y - grip.current.y;
    // `translate`, not `transform`: the lift (a slight scale) is the style sheet's to animate.
    element.style.translate = `${x}px ${y}px`;
  };

  /** Takes a step of the drag and shows it, redrawing only when who or where changed. */
  const show = (next: NameDrag) => {
    if (next === drag.current) return;
    drag.current = next;
    setDragging(
      next.kind === 'dragging'
        ? { crewMemberId: next.crewMemberId, over: next.over, before: next.before }
        : null,
    );
    if (next.kind !== 'dragging') setLiftedWidth(null);
    document.body.toggleAttribute('data-name-dragging', next.kind === 'dragging');
  };

  /**
   * Whatever press or drag is under way is over: nothing lifted, nothing
   * listened for. The lifted copy goes at once; where it was is passed on, so
   * the name can be shown settling into its place (or gliding back to it).
   */
  const end = () => {
    stopListening.current();
    stopListening.current = () => {};
    const was = drag.current;
    if (was.kind === 'dragging' && overlayElement.current) {
      onLetGoLatest.current?.(was.crewMemberId, overlayElement.current.getBoundingClientRect());
    }
    show(cancel(was));
  };

  // The screen is gone: so is any drag.
  useEffect(() => end, []);

  // iPhone Safari only lets a touch-move listener stop the page scrolling if
  // one that may do so was already there when the finger went down. This one
  // does nothing; it is there so the one a lifted name adds is listened to.
  useEffect(() => {
    window.addEventListener('touchmove', nothing, { passive: false });
    return () => window.removeEventListener('touchmove', nothing);
  }, []);

  const onPointerDown = (crewMemberId: string, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !event.isPrimary || drag.current.kind !== 'idle') return;
    const byFinger = event.pointerType === 'touch';
    pressedByFinger.current = byFinger;

    const source = event.currentTarget;
    const pointerId = event.pointerId;
    const at = { x: event.clientX, y: event.clientY };
    pointer.current = at;
    drag.current = press(crewMemberId, at);
    let stopEdgeScroll = () => {};
    let releaseHeights = () => {};
    /** What the finger is doing, when it is a finger that pressed. */
    let finger: Finger | null = byFinger ? fingerDown(at, performance.now()) : null;
    let liftTimer: ReturnType<typeof setTimeout> | undefined;

    /** The drag begins: lift a copy of the name, as wide as it is, held where it was pressed. */
    const begin = () => {
      const box = source.getBoundingClientRect();
      grip.current = {
        x: at.x - box.left,
        y: at.y - box.top + (byFinger ? ABOVE_THE_FINGER : 0),
      };
      setLiftedWidth(box.width);
      swallowNextClick(byFinger ? FINGER_CLICK_WITHIN : 0);
      releaseHeights = holdDestinationHeights();
      // A row out of sight is reached by holding the name at the edge of the schedule.
      stopEdgeScroll = startEdgeScroll(
        () => pointer.current,
        () => show(moveToPointer(drag.current, pointer.current)),
      );
      // Keep hearing the pointer if it leaves the window with the button down,
      // or if the name it went down on is taken off the page.
      try {
        pointerHolder().setPointerCapture(pointerId);
      } catch {
        // The pointer is already gone; the window listeners still end the drag.
      }
    };

    /** The finger has turned out not to be holding the name: nothing is picked up. */
    const giveUp = () => {
      if (finger?.kind !== 'holding') return;
      finger = fingerLost(finger);
      end();
    };

    /** The finger may have been held long enough: if so the name lifts, and the drag is on. */
    const liftIfHeld = () => {
      if (finger?.kind !== 'holding' || drag.current.kind !== 'pressed') return;
      const now = performance.now();
      finger = fingerHeld(finger, now);
      if (finger.kind !== 'lifted') {
        // The timer rang a moment early: wait out the rest.
        liftTimer = setTimeout(liftIfHeld, liftsIn(finger, now));
        return;
      }
      // From here the board is scrolled on purpose, by holding the name at its edge.
      window.removeEventListener('scroll', giveUp, true);
      begin();
      const { over, before } = whereAt(pointer.current, crewMemberId);
      show(lift(drag.current, over, before));
      // A short buzz, where the phone can (an iPhone cannot).
      try {
        navigator.vibrate?.(10);
      } catch {
        // No buzz, then.
      }
    };

    /** Once the name is lifted, a finger that moves drags it: the page must not scroll under it. */
    const holdThePage = (moved: TouchEvent) => {
      if (finger?.kind === 'lifted' && moved.cancelable) moved.preventDefault();
    };

    const onMove = (moved: PointerEvent) => {
      if (moved.pointerId !== pointerId) return;
      const was = drag.current;
      pointer.current = { x: moved.clientX, y: moved.clientY };

      if (finger && was.kind === 'pressed') {
        // Before the lift a finger only ever scrolls: too far, and that is what it is doing.
        finger = fingerMoved(finger, pointer.current);
        if (finger.kind === 'scroll') end();
        return;
      }
      if (was.kind === 'pressed') {
        // Still within a shaky click of where it was pressed: not a drag yet.
        if (moveTo(was, pointer.current, null).kind !== 'dragging') return;
        begin();
      }
      moved.preventDefault();
      show(moveToPointer(was, pointer.current));
      follow();
    };

    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) return;
      if (finger) finger = fingerUp(finger);
      // Let go where the pointer last was: the drop goes to the destination that was
      // highlighted, even if the names making room have since shifted the page under it.
      const moved = up.clientX !== pointer.current.x || up.clientY !== pointer.current.y;
      if (drag.current.kind === 'dragging' && moved) {
        pointer.current = { x: up.clientX, y: up.clientY };
        show(moveToPointer(drag.current, pointer.current));
      }
      const drop = release(drag.current);
      end();
      if (drop) onDropLatest.current(drop.crewMemberId, drop.over, drop.before);
    };

    const onKeyDown = (key: KeyboardEvent) => {
      if (key.key !== 'Escape' || drag.current.kind !== 'dragging') return;
      // This Escape ends the drag and nothing else: nobody else hears it.
      key.stopPropagation();
      end();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
    window.addEventListener('keydown', onKeyDown, true);
    if (finger) {
      liftTimer = setTimeout(liftIfHeld, liftsIn(finger, performance.now()));
      // The page, or a list in it, scrolled under the finger: it is not holding a name.
      window.addEventListener('scroll', giveUp, true);
      // On the name as well as the window: once the names make room, the name
      // the finger went down on may be off the page, and a finger's touch-moves
      // go only to what it went down on.
      source.addEventListener('touchmove', holdThePage, { passive: false });
      window.addEventListener('touchmove', holdThePage, { passive: false });
    }

    stopListening.current = () => {
      clearTimeout(liftTimer);
      window.removeEventListener('scroll', giveUp, true);
      source.removeEventListener('touchmove', holdThePage);
      window.removeEventListener('touchmove', holdThePage);
      stopEdgeScroll();
      releaseHeights();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
      window.removeEventListener('keydown', onKeyDown, true);
      if (pointerHolder().hasPointerCapture?.(pointerId)) pointerHolder().releasePointerCapture(pointerId);
    };
  };

  const placeOverlay = useCallback((element: HTMLElement | null) => {
    overlayElement.current = element;
    follow();
  }, []);

  const overlay =
    dragging && liftedWidth !== null
      ? createPortal(
          <div ref={placeOverlay} className="name-drag-overlay" style={{ width: liftedWidth }} aria-hidden="true">
            {drawLifted(dragging.crewMemberId)}
          </div>,
          document.body,
        )
      : null;

  return {
    dragging,
    nameProps: (crewMemberId) => ({
      'data-crew-member': crewMemberId,
      'data-dragging': dragging?.crewMemberId === crewMemberId ? true : undefined,
      onPointerDown: (event) => onPointerDown(crewMemberId, event),
      // A finger held on a name lifts it; the phone's own long-press menu stays away.
      onContextMenu: (event) => {
        if (pressedByFinger.current) event.preventDefault();
      },
    }),
    dropProps: (key) => ({
      'data-drop': key,
      'data-drop-over': dragging?.over === key ? true : undefined,
    }),
    overlay,
  };
}
