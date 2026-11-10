import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cancel, idle, moveTo, press, release, type DropKey, type NameDrag, type Point } from './nameDrag';
import { startEdgeScroll } from './edgeScroll';
import './drag.css';

/**
 * Dragging a Crew Member's name with the mouse, built on pointer events (not
 * the browser's own drag and drop, which gives no say over what is drawn under
 * the pointer). It knows names and destinations only by the marks put on them
 * (`nameProps`, `dropProps`) and applies no schedule rule: on a drop it reports
 * who was let go over which destination, and that is all.
 *
 * A press is only a drag once the pointer has moved a few pixels (see
 * `nameDrag`), so a click still selects and a double-click is still two clicks.
 */

/** The name being dragged right now, and the destination under the pointer. */
export interface Dragging {
  crewMemberId: string;
  over: DropKey | null;
}

/** What the name looked like when the drag began; the lifted copy is drawn from it. */
interface Lifted {
  className: string;
  text: string;
  width: number;
  height: number;
}

export interface NameDragOptions {
  /** False while names may not be dragged (a Note is being typed). */
  enabled: boolean;
  /** A name was let go over a destination. Not called for a drop outside one, or after Escape. */
  onDrop: (crewMemberId: string, over: DropKey) => void;
}

export interface NameDragHandle {
  /** Null unless a drag is under way. */
  dragging: Dragging | null;
  /** Spread on the element that is a Crew Member's name. */
  nameProps: (crewMemberId: string) => {
    'data-crew-member': string;
    'data-dragging': true | undefined;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Spread on an element that is a destination: anywhere inside it is a drop there. */
  dropProps: (key: DropKey) => { 'data-drop': DropKey; 'data-drop-over': true | undefined };
  /** The lifted copy of the name, following the pointer. Draw it anywhere; it is null when idle. */
  overlay: ReactNode;
}

/** The destination under a point of the window, if any. The lifted copy never counts: it lets the pointer through. */
function dropKeyAt(point: Point): DropKey | null {
  const under = document.elementFromPoint(point.x, point.y);
  return under?.closest<HTMLElement>('[data-drop]')?.dataset.drop ?? null;
}

/**
 * The browser follows a press and release with a click. After a drag that
 * click is not one the Scheduler made: it must not select a name or pick a
 * destination. This swallows it, whether the drag ended in a drop or was
 * cancelled with the button still down, and then stops listening.
 */
function swallowNextClick(): void {
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
  const stopSoon = () => setTimeout(stop, 0);
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerup', stopSoon, true);
  window.addEventListener('pointerdown', stop, true);
}

export function useNameDrag({ enabled, onDrop }: NameDragOptions): NameDragHandle {
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [lifted, setLifted] = useState<Lifted | null>(null);

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

  /** Puts the lifted copy under the pointer, held where it was taken hold of. No redraw. */
  const follow = () => {
    const element = overlayElement.current;
    if (!element) return;
    const x = pointer.current.x - grip.current.x;
    const y = pointer.current.y - grip.current.y;
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  /** Takes a step of the drag and shows it, redrawing only when who or where changed. */
  const show = (next: NameDrag) => {
    if (next === drag.current) return;
    drag.current = next;
    setDragging(
      next.kind === 'dragging' ? { crewMemberId: next.crewMemberId, over: next.over } : null,
    );
    if (next.kind !== 'dragging') setLifted(null);
    document.body.toggleAttribute('data-name-dragging', next.kind === 'dragging');
  };

  /** Whatever press or drag is under way is over: nothing lifted, nothing listened for. */
  const end = () => {
    stopListening.current();
    stopListening.current = () => {};
    show(cancel(drag.current));
  };

  // Names can no longer be dragged (a Note is now being typed), or the screen is gone.
  useEffect(() => {
    if (!enabled) end();
  }, [enabled]);
  useEffect(() => end, []);

  const onPointerDown = (crewMemberId: string, event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0 || !event.isPrimary || drag.current.kind !== 'idle') return;

    const source = event.currentTarget;
    const pointerId = event.pointerId;
    const at = { x: event.clientX, y: event.clientY };
    pointer.current = at;
    drag.current = press(crewMemberId, at);
    let stopEdgeScroll = () => {};

    const onMove = (moved: PointerEvent) => {
      if (moved.pointerId !== pointerId) return;
      const was = drag.current;
      pointer.current = { x: moved.clientX, y: moved.clientY };

      if (was.kind === 'pressed') {
        // Still within a shaky click of where it was pressed: not a drag yet.
        if (moveTo(was, pointer.current, null).kind !== 'dragging') return;

        // The drag begins: lift a copy of the name as it looks right now.
        const box = source.getBoundingClientRect();
        grip.current = { x: at.x - box.left, y: at.y - box.top };
        setLifted({
          className: source.className,
          text: source.textContent ?? '',
          width: box.width,
          height: box.height,
        });
        swallowNextClick();
        // A row out of sight is reached by holding the name at the edge of the schedule.
        stopEdgeScroll = startEdgeScroll(
          () => pointer.current,
          () => show(moveTo(drag.current, pointer.current, dropKeyAt(pointer.current))),
        );
        // Keep hearing the pointer if it leaves the window with the button down.
        try {
          source.setPointerCapture(pointerId);
        } catch {
          // The pointer is already gone; the window listeners still end the drag.
        }
      }
      moved.preventDefault();
      show(moveTo(was, pointer.current, dropKeyAt(pointer.current)));
      follow();
    };

    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) return;
      if (drag.current.kind === 'dragging') {
        pointer.current = { x: up.clientX, y: up.clientY };
        show(moveTo(drag.current, pointer.current, dropKeyAt(pointer.current)));
      }
      const drop = release(drag.current);
      end();
      if (drop) onDropLatest.current(drop.crewMemberId, drop.over);
    };

    const onKeyDown = (key: KeyboardEvent) => {
      if (key.key === 'Escape' && drag.current.kind === 'dragging') end();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
    window.addEventListener('keydown', onKeyDown, true);

    stopListening.current = () => {
      stopEdgeScroll();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
      window.removeEventListener('keydown', onKeyDown, true);
      if (source.hasPointerCapture?.(pointerId)) source.releasePointerCapture(pointerId);
    };
  };

  const placeOverlay = useCallback((element: HTMLElement | null) => {
    overlayElement.current = element;
    follow();
  }, []);

  const overlay =
    dragging && lifted
      ? createPortal(
          <div
            ref={placeOverlay}
            className={`${lifted.className} name-drag-overlay`}
            style={{ width: lifted.width, height: lifted.height }}
            aria-hidden="true"
          >
            {lifted.text}
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
    }),
    dropProps: (key) => ({
      'data-drop': key,
      'data-drop-over': dragging?.over === key ? true : undefined,
    }),
    overlay,
  };
}
