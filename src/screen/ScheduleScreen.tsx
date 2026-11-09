import {
  fullDate,
  scheduleView,
  type CrewMember,
  type DailySchedule,
  type Roster,
} from '../schedule-rules';

/**
 * The Scheduler's screen. Thin: it asks the schedule rules for the view and
 * draws it. It applies no rule (ordering, Not Placed, ...) itself.
 */
export function ScheduleScreen({ roster, schedule }: { roster: Roster; schedule: DailySchedule }) {
  const view = scheduleView(roster, schedule);

  return (
    <main className="screen">
      <h1 className="date-heading">{fullDate(view.date)}</h1>

      <div className="layout">
        <table className="schedule">
          <thead>
            <tr>
              <th className="col-job">JOB</th>
              <th className="col-tasks">TASKS</th>
              <th className="col-who">WHO</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.key} className={`row row-${row.destination.kind}`}>
                <th scope="row" className="job">
                  {row.label}
                </th>
                <td className="tasks">
                  {row.tasks.map((task, index) => (
                    <div key={index} className="task">
                      {task}
                    </div>
                  ))}
                </td>
                <td className="who">
                  <ul className="names">
                    {row.who.map(({ crewMember, note }) => (
                      <li key={crewMember.id}>
                        <CrewMemberName crewMember={crewMember} />
                        {note && <span className="note">{note}</span>}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="not-placed" aria-labelledby="not-placed-heading">
          <h2 id="not-placed-heading">NOT PLACED</h2>
          {view.notPlaced.length === 0 ? (
            <p className="not-placed-empty">Everyone is placed.</p>
          ) : (
            <ul className="names names-stacked">
              {view.notPlaced.map((crewMember) => (
                <li key={crewMember.id}>
                  <CrewMemberName crewMember={crewMember} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}

function CrewMemberName({ crewMember }: { crewMember: CrewMember }) {
  return <span className={`name color-${crewMember.color}`}>{crewMember.name}</span>;
}
