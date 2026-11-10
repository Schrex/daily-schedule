import { useState } from 'react';
import { fullDate, type ScheduleDate } from '../schedule-rules';
import './change-date.css';

interface ChangeDateProps {
  /** The date of the Daily Schedule on the screen. */
  date: ScheduleDate;
  /** The Scheduler picked another date and confirmed it. */
  onChangeDate: (date: ScheduleDate) => void;
}

/**
 * The "Change date" button in the toolbar and the panel it opens, for the rare
 * Saturday or holiday. Thin: it only collects a date. Whether that date's
 * Daily Schedule is opened or created is decided by the schedule rules, not here.
 */
export function ChangeDate({ date, onChangeDate }: ChangeDateProps) {
  // null while the panel is closed; otherwise the date picked so far ('' if cleared).
  const [picked, setPicked] = useState<string | null>(null);

  const close = () => setPicked(null);
  const valid = picked !== null && /^\d{4}-\d{2}-\d{2}$/.test(picked);

  return (
    <>
      <button type="button" className="toolbar-button" onClick={() => setPicked(date)}>
        Change date
      </button>

      {picked !== null && (
        <div
          className="change-date-backdrop"
          onClick={close}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <form
            className="change-date-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-date-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!valid) return;
              close();
              if (picked !== date) onChangeDate(picked);
            }}
          >
            <h2 id="change-date-title">Which day do you want to schedule?</h2>

            <input
              type="date"
              className="change-date-input"
              aria-label="Date to schedule"
              value={picked}
              autoFocus
              onChange={(event) => setPicked(event.target.value)}
            />

            <p className="change-date-picked" role="status">
              {valid ? fullDate(picked) : 'Pick a day above.'}
            </p>

            <div className="change-date-actions">
              <button type="submit" className="change-date-open" disabled={!valid}>
                Open this day
              </button>
              <button type="button" className="change-date-cancel" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
