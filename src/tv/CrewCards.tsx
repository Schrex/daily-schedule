import { useEffect, useState } from 'react';
import { cardTitle, type CrewView, type Roster, type ScheduleRow } from '../schedule-rules';
import { crewPictureColumns, type PictureColumns } from '../send/crewPicture';

/**
 * The crew picture's columns for a crew view: two of Jobs and one at the
 * right for Shop, Trucking and Off Work, each card in the same column as on
 * the picture (worked out by the picture itself). Null until that is known.
 */
export function useCrewColumns(view: CrewView, roster: Roster): PictureColumns | null {
  const [columns, setColumns] = useState<PictureColumns | null>(null);
  useEffect(() => {
    let current = true;
    crewPictureColumns(view, roster).then(
      (worked) => current && setColumns(worked),
      (error) => console.error('Could not work out the columns', error),
    );
    return () => {
      current = false;
    };
  }, [view, roster]);
  return columns;
}

/**
 * The cards the crew is sent, as the Office TV and the Crew Page draw them:
 * the Notes for the day across the top, then the cards in the crew picture's
 * columns (`useCrewColumns`). Until those are known, the Jobs and the rest
 * stand in the same columns in order. On a phone it is one column (cards.css).
 */
export function CrewCards({
  roster,
  view,
  columns,
}: {
  roster: Roster;
  view: CrewView;
  columns: PictureColumns | null;
}) {
  const byKey = new Map(view.rows.map((row) => [row.key, row]));
  const shown = columns ?? firstGuess(view);

  return (
    <>
      {/* The Notes for the day first, across the board, as on the crew picture. */}
      {view.dayNotes && view.dayNotes.length > 0 && (
        <section className="tv-card tv-day-notes">
          <h2 className="tv-card-name tv-card-name-yard">Notes</h2>
          {view.dayNotes.map((note, index) => (
            <p key={index} className="tv-day-note">
              {note}
            </p>
          ))}
        </section>
      )}
      <main
        className="tv-cards"
        style={{ gridTemplateColumns: shown.columns.map(({ share }) => `minmax(0, ${share}fr)`).join(' ') }}
      >
        {shown.columns.map(({ keys }, index) => (
          <div key={index} className="tv-column">
            {keys.flatMap((key) => {
              const row = byKey.get(key);
              return row ? [<Card key={key} roster={roster} row={row} />] : [];
            })}
          </div>
        ))}
      </main>
    </>
  );
}

/** Jobs shared out over two columns in order, and the rest in a third: until the picture's own columns are known. */
function firstGuess(view: CrewView): PictureColumns {
  const jobs = view.rows.filter((row) => row.destination.kind === 'job').map((row) => row.key);
  const yard = view.rows.filter((row) => row.destination.kind !== 'job').map((row) => row.key);
  const jobColumns = Math.max(1, Math.min(2, jobs.length));
  const columns = Array.from({ length: jobColumns }, (_, index) => ({
    share: 1,
    keys: jobs.filter((_, at) => at % jobColumns === index),
  }));
  return { columns: yard.length > 0 ? [...columns, { share: 1, keys: yard }] : columns };
}

function Card({ roster, row }: { roster: Roster; row: ScheduleRow }) {
  const isJob = row.destination.kind === 'job';
  const quiet = row.destination.kind === 'standing-row' && row.destination.standingRow === 'off-work';
  const { name, number } = cardTitle(roster, row);
  return (
    <section className={`tv-card${quiet ? ' tv-card-quiet' : ''}`}>
      <div className="tv-card-head">
        <h2 className={`tv-card-name${isJob ? '' : ' tv-card-name-yard'}`}>
          {name}
          {number && <span className="tv-card-number">{number}</span>}
        </h2>
        <span className="tv-card-count">{row.who.length}</span>
      </div>
      {row.tasks.length > 0 && (
        <ul className={`tv-tasks${isJob ? '' : ' tv-tasks-yard'}`}>
          {row.tasks.map((task, index) => (
            <li key={index}>{task}</li>
          ))}
        </ul>
      )}
      <ul className="tv-names">
        {row.who.map(({ crewMember, note, personTasks = [] }) => (
          <li key={crewMember.id} className={`tv-name${crewMember.foreman ? ' tv-name-foreman' : ''}`}>
            <div className="tv-name-head">
              <span className={`tv-dot dot-${crewMember.color}`} />
              <span className="tv-name-text">{crewMember.name}</span>
            </div>
            {personTasks.length > 0 && (
              <ul className="tv-name-subs">
                {personTasks.map((task, index) => (
                  <li key={index}>{task}</li>
                ))}
              </ul>
            )}
            {note && <p className="tv-note">{note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
