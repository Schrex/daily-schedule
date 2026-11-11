import { useEffect, useRef, useState } from 'react';
import { crewView, type DailySchedule, type Roster } from '../schedule-rules';
import { drawCrewPicture } from '../send/crewPicture';

/** The picture being shown: drawing, ready (the canvas it was drawn on), or it could not be drawn. */
type Shown = { kind: 'drawing' } | { kind: 'ready'; canvas: HTMLCanvasElement } | { kind: 'failed' };

/**
 * "Preview": the picture the crew would get if "Send to crew" were pressed
 * now, drawn exactly as Send draws it (the same crew view, stamped with the
 * time now), shown large over the blurred board with nothing else around it.
 * It is shown straight off the canvas it is drawn on: making it into a PNG
 * file, as Send must, would take longer than drawing it.
 * Escape, or a click outside it, closes it. It records nothing and copies nothing: only Send does that.
 */
export function PreviewPicture({ roster, schedule }: { roster: Roster; schedule: DailySchedule }) {
  const [shown, setShown] = useState<Shown | null>(null);
  /** Which opening the picture being drawn belongs to: one closed meanwhile is not shown. */
  const opening = useRef(0);

  const open = () => {
    const thisOpening = ++opening.current;
    setShown({ kind: 'drawing' });
    drawCrewPicture(crewView(roster, schedule), new Date(), roster)
      .then((canvas) => {
        if (opening.current === thisOpening) setShown({ kind: 'ready', canvas });
      })
      .catch((error) => {
        console.error('Could not draw the preview', error);
        if (opening.current === thisOpening) setShown({ kind: 'failed' });
      });
  };

  const close = () => {
    opening.current++;
    setShown(null);
  };

  // While it is open, Escape closes it, wherever the focus is.
  const isOpen = shown !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button type="button" className="button toolbar-button" onClick={open}>
        Preview
      </button>

      {shown && (
        <div className="preview-backdrop" onClick={close}>
          <div
            className="preview-panel"
            role="dialog"
            aria-modal="true"
            aria-label="What the crew will see. Nothing is sent or copied. Press Escape to close."
            tabIndex={-1}
            ref={(panel) => panel?.focus()}
            onClick={(event) => event.stopPropagation()}
          >
            {shown.kind === 'drawing' && <p className="preview-status">Drawing the picture…</p>}
            {shown.kind === 'failed' && <p className="preview-status">The picture could not be drawn.</p>}
            {shown.kind === 'ready' && <ShowCanvas canvas={shown.canvas} />}
          </div>
        </div>
      )}
    </>
  );
}

/** The drawn picture itself, put in the page as it is, sized by the panel. */
function ShowCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  return (
    <div
      className="preview-picture"
      ref={(holder) => {
        if (!holder) return;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'The Daily Schedule picture for the crew');
        holder.replaceChildren(canvas);
      }}
    />
  );
}
