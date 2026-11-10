import { useState, type FormEvent } from 'react';
import {
  COLORS,
  addCrewMember,
  addJob,
  changeCrewMember,
  jobLabel,
  moveJob,
  removeCrewMember,
  removeJob,
  type Color,
  type CrewMember,
  type Roster,
} from '../schedule-rules';
import type { ScheduleStore } from '../storage';

/**
 * The settings page, where the office manages Crew Members and Jobs. Thin:
 * every change applies one roster rule and saves the result straight away, so
 * there is no Save button. `roster` is what the store held when the page loaded.
 */
export function SettingsPage({ store, roster: loaded }: { store: ScheduleStore; roster: Roster }) {
  const [roster, setRoster] = useState<Roster>(loaded);

  /** The one place the roster changes. Every change is saved by itself. */
  const change = (rule: (roster: Roster) => Roster) => {
    const next = rule(roster);
    if (next === roster) return;
    setRoster(next);
    store.saveRoster(next).catch((error) => console.error('Could not save the roster', error));
  };

  return (
    <main className="settings">
      <a className="button settings-back" href="index.html">
        <span aria-hidden="true">←</span> Back to the Daily Schedule
      </a>
      <h1>Daily Schedule settings</h1>
      <p className="settings-intro">
        Changes are saved automatically. The Daily Schedule shows them the next time it is opened.
      </p>

      <section aria-labelledby="crew-heading">
        <h2 id="crew-heading">Crew Members</h2>
        <table className="settings-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Color</th>
              <th>Foreman</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roster.crewMembers.map((crewMember) => (
              <CrewMemberRow
                key={crewMember.id}
                crewMember={crewMember}
                onChange={(changes) =>
                  change((current) => changeCrewMember(current, crewMember.id, changes))
                }
                onRemove={() => {
                  const sure = window.confirm(
                    `Remove ${crewMember.name}? They will no longer appear on the Daily Schedule.`,
                  );
                  if (sure) change((current) => removeCrewMember(current, crewMember.id));
                }}
              />
            ))}
          </tbody>
        </table>
        <AddCrewMember onAdd={(details) => change((current) => addCrewMember(current, details))} />
      </section>

      <section aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Jobs</h2>
        <p className="settings-hint">Jobs appear on the Daily Schedule in this order.</p>
        <table className="settings-table">
          <tbody>
            {roster.jobs.map((job, index) => (
              <tr key={job.id} data-job={job.id}>
                <td className="job-label">{jobLabel(job)}</td>
                <td className="actions">
                  <button
                    type="button"
                    className="button"
                    disabled={index === 0}
                    aria-label={`Move ${jobLabel(job)} up`}
                    onClick={() => change((current) => moveJob(current, job.id, 'up'))}
                  >
                    ▲ Up
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={index === roster.jobs.length - 1}
                    aria-label={`Move ${jobLabel(job)} down`}
                    onClick={() => change((current) => moveJob(current, job.id, 'down'))}
                  >
                    ▼ Down
                  </button>
                  <button
                    type="button"
                    className="button remove"
                    aria-label={`Remove ${jobLabel(job)}`}
                    onClick={() => {
                      const sure = window.confirm(
                        `Remove ${jobLabel(job)}? Anyone placed on it will be Not Placed.`,
                      );
                      if (sure) change((current) => removeJob(current, job.id));
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddJob onAdd={(details) => change((current) => addJob(current, details))} />
      </section>
    </main>
  );
}

function CrewMemberRow({
  crewMember,
  onChange,
  onRemove,
}: {
  crewMember: CrewMember;
  onChange: (changes: { name?: string; color?: Color; foreman?: boolean }) => void;
  onRemove: () => void;
}) {
  // The name is saved when the field is left (or Enter is pressed), not on every key.
  const [name, setName] = useState(crewMember.name);

  const saveName = () => {
    if (name.trim() === '') {
      setName(crewMember.name); // a Crew Member must have a name: put the old one back
      return;
    }
    setName(name.trim());
    onChange({ name });
  };

  return (
    <tr data-crew-member={crewMember.id}>
      <td>
        <input
          type="text"
          className="name-field"
          aria-label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </td>
      <td>
        <ColorPicker
          name={`color-${crewMember.id}`}
          value={crewMember.color}
          onPick={(color) => onChange({ color })}
        />
      </td>
      <td>
        <label className="foreman">
          <input
            type="checkbox"
            checked={crewMember.foreman}
            onChange={(event) => onChange({ foreman: event.target.checked })}
          />
          Foreman
        </label>
      </td>
      <td className="actions">
        <button
          type="button"
          className="button remove"
          aria-label={`Remove ${crewMember.name}`}
          onClick={onRemove}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

/** The fixed palette as five swatches; the chosen one is ringed. */
function ColorPicker({
  name,
  value,
  onPick,
}: {
  name: string;
  value: Color;
  onPick: (color: Color) => void;
}) {
  return (
    <span className="colors" role="radiogroup" aria-label="Color">
      {COLORS.map((color) => (
        <label key={color} className={`swatch color-${color}`}>
          <input
            type="radio"
            name={name}
            value={color}
            checked={color === value}
            onChange={() => onPick(color)}
          />
          {color}
        </label>
      ))}
    </span>
  );
}

function AddCrewMember({
  onAdd,
}: {
  onAdd: (details: { name: string; color: Color; foreman: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<Color>('blue');
  const [foreman, setForeman] = useState(false);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === '') return;
    onAdd({ name, color, foreman });
    setName('');
    setForeman(false);
  };

  return (
    <form className="add" onSubmit={add} aria-label="Add a Crew Member">
      <h3>Add a Crew Member</h3>
      <label>
        Name
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <ColorPicker name="color-new" value={color} onPick={setColor} />
      <label className="foreman">
        <input
          type="checkbox"
          checked={foreman}
          onChange={(event) => setForeman(event.target.checked)}
        />
        Foreman
      </label>
      <button type="submit" className="button button-primary" disabled={name.trim() === ''}>
        Add Crew Member
      </button>
    </form>
  );
}

function AddJob({ onAdd }: { onAdd: (details: { name: string; jobNumber: string }) => void }) {
  const [name, setName] = useState('');
  const [jobNumber, setJobNumber] = useState('');

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === '') return;
    onAdd({ name, jobNumber });
    setName('');
    setJobNumber('');
  };

  return (
    <form className="add" onSubmit={add} aria-label="Add a Job">
      <h3>Add a Job</h3>
      <label>
        Job number (optional)
        <input
          type="text"
          className="job-number-field"
          value={jobNumber}
          onChange={(event) => setJobNumber(event.target.value)}
        />
      </label>
      <label>
        Name
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="submit" className="button button-primary" disabled={name.trim() === ''}>
        Add Job
      </button>
    </form>
  );
}
