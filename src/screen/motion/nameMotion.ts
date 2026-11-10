import { nameMove, type Seen } from './nameMove';
import './motion.css';

/**
 * Shows every move of a Crew Member's name: whenever the page is redrawn, each
 * name that is now somewhere else starts from where it was last seen and
 * travels to its new place (the "FLIP" technique). It does not know why a name
 * moved (a drop, a click-click move, a double-click, Undo, the others making
 * room): it only compares where names were with where they are.
 *
 * It knows names by the mark the drag puts on them (`data-crew-member`) and
 * the areas that cut off their contents by `data-motion-area`. Only
 * `transform` and `opacity` are animated, with the Web Animations API, and
 * nothing waits for an animation: the page under it is already as it will be,
 * a new move starts from wherever the last one had got to, and the names stay
 * clickable throughout. How long a move takes is the look's (`--move-duration`
 * in src/look.css); where the look gives it no time (the computer is set to
 * reduce motion), nothing moves.
 */

/** Where every name was seen at one instant, by Crew Member id. */
export type NamesSeen = ReadonlyMap<string, Seen>;

export interface NameMotion {
  /** Call just before the page changes: where each name is seen right now. */
  seen(): NamesSeen;
  /** Call just after the page changed: sets every name that moved travelling from where it was seen. */
  play(before: NamesSeen): void;
  /**
   * A name was up in the air (the lifted copy of a drag) at `box` when it was
   * let go. Its next move starts from there, not from where the page drew it.
   */
  letGoAt(crewMemberId: string, box: DOMRect): void;
  /** Ends every move at once, each name in its place. */
  stop(): void;
}

/** A move under way. */
interface Travelling {
  /** The name on the page that is travelling (or stands hidden while its copy flies). */
  element: HTMLElement;
  /** The place on the page it is heading for. */
  to: { x: number; y: number };
  animations: Animation[];
  /** The copy flying over the page, when the name could not be seen crossing by itself. */
  copy?: HTMLElement;
}

const NAME = '[data-crew-member]';
const AREA = '[data-motion-area]';

/**
 * How long (milliseconds) and how a move goes: the look's `--move-duration`
 * and `--move-ease`. No duration means no motion: the look gives none when the
 * computer is set to reduce motion (and a page without the look has none).
 */
function timing(): { duration: number; easing: string } {
  const look = getComputedStyle(document.documentElement);
  const duration = parseFloat(look.getPropertyValue('--move-duration'));
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    easing: look.getPropertyValue('--move-ease').trim(),
  };
}

export function createNameMotion(): NameMotion {
  const travelling = new Map<string, Travelling>();
  const letGo = new Map<string, Seen>();

  const names = () => document.querySelectorAll<HTMLElement>(NAME);

  const stopOne = (crewMemberId: string) => {
    const move = travelling.get(crewMemberId);
    if (!move) return;
    travelling.delete(crewMemberId);
    for (const animation of move.animations) animation.cancel();
    move.copy?.remove();
    move.element.style.opacity = '';
  };

  /** The name's own place on the page, leaving out how far a slide still has it shifted. */
  const place = (element: HTMLElement, move: Travelling | undefined): Seen => {
    const box = element.getBoundingClientRect();
    const area = element.closest(AREA);
    if (move?.element !== element || move.copy) {
      return { x: box.x, y: box.y, width: box.width, height: box.height, area };
    }
    const shift = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: box.x - shift.m41, y: box.y - shift.m42, width: box.width, height: box.height, area };
  };

  const start = (crewMemberId: string, move: Travelling) => {
    travelling.set(crewMemberId, move);
    const done = () => {
      if (travelling.get(crewMemberId) === move) stopOne(crewMemberId);
    };
    move.animations[0]!.onfinish = done;
  };

  return {
    seen() {
      const seen = new Map<string, Seen>();
      for (const element of names()) {
        const crewMemberId = element.dataset.crewMember!;
        const move = travelling.get(crewMemberId);
        // A flying copy is what is seen, not the hidden name it is flying to.
        const shown = move?.element === element && move.copy ? move.copy : element;
        const box = shown.getBoundingClientRect();
        seen.set(crewMemberId, {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          area: shown === element ? element.closest(AREA) : null,
        });
      }
      for (const [crewMemberId, at] of letGo) seen.set(crewMemberId, at);
      return seen;
    },

    play(before) {
      const { duration, easing } = timing();
      const still = duration <= 0;
      const present = new Set<string>();

      for (const element of names()) {
        const crewMemberId = element.dataset.crewMember!;
        present.add(crewMemberId);
        const under = travelling.get(crewMemberId);

        // The name in the air under the pointer marks where it would land; it does not travel.
        if (still || element.hasAttribute('data-dragging')) {
          stopOne(crewMemberId);
          continue;
        }

        const now = place(element, under);
        const headingThere =
          under?.element === element &&
          Math.abs(under.to.x - now.x) < 0.5 &&
          Math.abs(under.to.y - now.y) < 0.5;
        if (headingThere && !letGo.has(crewMemberId)) continue; // already on its way to the right place

        stopOne(crewMemberId);
        const move = nameMove(before.get(crewMemberId), now);
        if (move.kind === 'stay') continue;
        const to = { x: now.x, y: now.y };

        if (move.kind === 'slide') {
          const slide = element.animate(
            [{ transform: `translate(${move.dx}px, ${move.dy}px)` }, { transform: 'none' }],
            { duration, easing },
          );
          start(crewMemberId, { element, to, animations: [slide] });
          continue;
        }

        // Fly a copy over the page; the name itself waits unseen (still clickable) in its place.
        const copy = element.cloneNode(true) as HTMLElement;
        for (const mark of ['data-crew-member', 'data-dragging', 'aria-pressed', 'id']) {
          copy.removeAttribute(mark);
        }
        copy.classList.add('name-flying');
        copy.setAttribute('aria-hidden', 'true');
        copy.inert = true;
        copy.style.left = `${now.x}px`;
        copy.style.top = `${now.y}px`;
        copy.style.width = `${now.width}px`;
        copy.style.height = `${now.height}px`;
        copy.style.opacity = '';
        document.body.append(copy);
        element.style.opacity = '0';

        const flight = copy.animate(
          [
            {
              transform: `translate(${move.dx}px, ${move.dy}px) scale(${move.scaleX}, ${move.scaleY})`,
            },
            { transform: 'none' },
          ],
          { duration, easing, fill: 'forwards' },
        );
        // Its shadow thins out as it comes down.
        const shadow = copy.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], {
          duration,
          fill: 'forwards',
          pseudoElement: '::after',
        });
        start(crewMemberId, { element, to, animations: [flight, shadow], copy });
      }

      letGo.clear();
      for (const crewMemberId of [...travelling.keys()]) {
        if (!present.has(crewMemberId)) stopOne(crewMemberId);
      }
    },

    letGoAt(crewMemberId, box) {
      if (timing().duration <= 0) return;
      letGo.set(crewMemberId, { x: box.x, y: box.y, width: box.width, height: box.height, area: null });
    },

    stop() {
      letGo.clear();
      for (const crewMemberId of [...travelling.keys()]) stopOne(crewMemberId);
    },
  };
}
