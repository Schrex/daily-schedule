import { useEffect, useRef, useState } from 'react';
import { crewView, type DailySchedule, type Roster } from '../schedule-rules';
import { renderCrewPicture } from '../send/crewPicture';

/** The picture being shown: drawing, ready (its address), or it could not be drawn. */
type Shown = { kind: 'drawing' } | { kind: 'ready'; url: string } | { kind: 'failed' };

/**
 * "Preview": the picture the crew would get if "Send to crew" were pressed
 * now, drawn exactly as Send draws it (the same crew view, UPDATED marker and
 * all), shown large over the blurred board, with nothing else around it but
 * a × to close it. It records nothing and copies nothing: only Send does that.
 */
export function PreviewPicture({ roster, schedule }: { roster: Roster; schedule: DailySchedule }) {
  const [shown, setShown] = useState<Shown | null>(null);
  /** Which opening the picture being drawn belongs to: one closed meanwhile is not shown. */
  const opening = useRef(0);

  const open = () => {
    const thisOpening = ++opening.current;
    setShown({ kind: 'drawing' });
    renderCrewPicture(crewView(roster, schedule), roster)
      .then((picture) => {
        if (opening.current === thisOpening) setShown({ kind: 'ready', url: URL.createObjectURL(picture) });
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

  // The picture's address is let go of once it is no longer shown.
  useEffect(() => {
    if (shown?.kind !== 'ready') return;
    return () => URL.revokeObjectURL(shown.url);
  }, [shown]);

  return (
    <>
      <button type="button" className="button toolbar-button" onClick={open}>
        Preview
      </button>

      {shown && (
        <div
          className="preview-backdrop"
          onClick={close}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div
            className="preview-panel"
            role="dialog"
            aria-modal="true"
            aria-label="What the crew will see. Nothing is sent or copied."
            onClick={(event) => event.stopPropagation()}
          >
            {shown.kind === 'drawing' && <p className="preview-status">Drawing the picture…</p>}
            {shown.kind === 'failed' && <p className="preview-status">The picture could not be drawn.</p>}
            {shown.kind === 'ready' && <img src={shown.url} alt="The Daily Schedule picture for the crew" />}
            <button type="button" className="preview-close" aria-label="Close the preview" autoFocus onClick={close}>
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
