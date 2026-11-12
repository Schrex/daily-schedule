import { useEffect, useState, type ReactNode } from 'react';
import {
  COLORS,
  addCrewMember,
  addJob,
  changeCrewMember,
  changeJob,
  jobLabel,
  moveJob,
  removeCrewMember,
  removeJob,
  type Color,
  type CrewMember,
  type Job,
  type Roster,
} from '../schedule-rules';
import { COLOR_NAMES } from '../palette';
import type { ScheduleStore } from '../storage';

/** What is open over the page: one Crew Member, one Job, or a new one of either. */
type Open =
  | { kind: 'crew-member'; id: string }
  | { kind: 'new-crew-member' }
  | { kind: 'job'; id: string }
  | { kind: 'new-job' }
  | null;

/**
 * The settings page, where the roster (Crew Members and Jobs) is managed. It is
 * two plain lists: every name is one large button, and clicking it opens a
 * panel for that one Crew Member or Job, so nothing that changes or removes
 * anything is on show until one has been chosen. Thin: every change applies one
 * roster rule and saves the result straight away, so there is no Save button.
 * `roster` is what the store held when the page loaded.
 */
export function SettingsPage({ store, roster: loaded }: { store: ScheduleStore; roster: Roster }) {
  const [roster, setRoster] = useState<Roster>(loaded);
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  /** The one place the roster changes. Every change is saved by itself. */
  const change = (rule: (roster: Roster) => Roster) => {
    const next = rule(roster);
    if (next === roster) return;
    setRoster(next);
    store.saveRoster(next).catch((error) => console.error('Could not save the roster', error));
  };

  const openCrewMember =
    open?.kind === 'crew-member' ? roster.crewMembers.find((each) => each.id === open.id) : undefined;
  const openJobIndex = open?.kind === 'job' ? roster.jobs.findIndex((each) => each.id === open.id) : -1;
  const openJob = openJobIndex === -1 ? undefined : roster.jobs[openJobIndex];

  return (
    <main className="settings">
      <a className="button settings-back" href="index.html">
        <span aria-hidden="true">←</span> Back to the Daily Schedule
      </a>
      <h1>Settings</h1>
      <p className="settings-intro">
        Click a name to change it. Everything is saved by itself.
      </p>

      <section aria-labelledby="crew-heading">
        <h2 id="crew-heading">Crew Members</h2>
        <ul className="settings-names">
          {roster.crewMembers.map((crewMember) => (
            <li key={crewMember.id}>
              <button
                type="button"
                className={`settings-name color-${crewMember.color}`}
                data-crew-member={crewMember.id}
                onClick={() => setOpen({ kind: 'crew-member', id: crewMember.id })}
              >
                {crewMember.name}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="button settings-add"
          onClick={() => setOpen({ kind: 'new-crew-member' })}
        >
          <span aria-hidden="true">+</span> Add a Crew Member
        </button>
      </section>

      <section aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Jobs</h2>
        <p className="settings-hint">Jobs appear on the Daily Schedule in this order.</p>
        <ol className="settings-jobs">
          {roster.jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                className="settings-job"
                data-job={job.id}
                onClick={() => setOpen({ kind: 'job', id: job.id })}
              >
                {jobLabel(job)}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="button settings-add" onClick={() => setOpen({ kind: 'new-job' })}>
          <span aria-hidden="true">+</span> Add a Job
        </button>
      </section>

      {openCrewMember && (
        <CrewMemberPanel
          key={openCrewMember.id}
          crewMember={openCrewMember}
          onChange={(changes) =>
            change((current) => changeCrewMember(current, openCrewMember.id, changes))
          }
          onRemove={() => {
            change((current) => removeCrewMember(current, openCrewMember.id));
            close();
          }}
          onClose={close}
        />
      )}

      {open?.kind === 'new-crew-member' && (
        <NewCrewMemberPanel
          onAdd={(details) => {
            change((current) => addCrewMember(current, details));
            close();
          }}
          onClose={close}
        />
      )}

      {openJob && (
        <JobPanel
          key={openJob.id}
          job={openJob}
          position={openJobIndex + 1}
          of={roster.jobs.length}
          onChange={(changes) => change((current) => changeJob(current, openJob.id, changes))}
          onMove={(direction) => change((current) => moveJob(current, openJob.id, direction))}
          onRemove={() => {
            change((current) => removeJob(current, openJob.id));
            close();
          }}
          onClose={close}
        />
      )}

      {open?.kind === 'new-job' && (
        <NewJobPanel
          onAdd={(details) => {
            change((current) => addJob(current, details));
            close();
          }}
          onClose={close}
        />
      )}
    </main>
  );
}

/** The panel over the page: one thing at a time. Escape or a click outside closes it. */
function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-panel" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** A large text box with its label above it. */
function Field({
  label,
  value,
  onChange,
  onLeave,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onLeave?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onLeave}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** The fixed palette as six large swatches; the chosen one is ringed. */
function ColorPicker({ value, onPick }: { value: Color; onPick: (color: Color) => void }) {
  return (
    <div className="settings-field">
      <span className="settings-label" id="color-label">
        Color
      </span>
      <span className="colors" role="radiogroup" aria-labelledby="color-label">
        {COLORS.map((color) => (
          <label key={color} className={`swatch color-${color}`}>
            <input
              type="radio"
              name="color"
              value={color}
              checked={color === value}
              onChange={() => onPick(color)}
            />
            {COLOR_NAMES[color]}
          </label>
        ))}
      </span>
    </div>
  );
}

function ForemanBox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        Foreman <span className="settings-check-hint">(listed first on a Job)</span>
      </span>
    </label>
  );
}

/**
 * Removing is out of the way at the foot of the panel and takes two clicks: the
 * first only asks, in the panel itself, what will happen.
 */
function RemoveBox({
  label,
  warning,
  onRemove,
}: {
  label: string;
  warning: string;
  onRemove: () => void;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <div className="settings-remove">
        <button type="button" className="settings-remove-link" onClick={() => setAsking(true)}>
          {label}
        </button>
      </div>
    );
  }
  return (
    <div className="settings-remove settings-remove-asking" role="alert">
      <p>{warning}</p>
      <div className="settings-buttons">
        <button type="button" className="button settings-remove-yes" onClick={onRemove}>
          Yes, remove
        </button>
        <button type="button" className="button" onClick={() => setAsking(false)}>
          No, keep
        </button>
      </div>
    </div>
  );
}

function CrewMemberPanel({
  crewMember,
  onChange,
  onRemove,
  onClose,
}: {
  crewMember: CrewMember;
  onChange: (changes: { name?: string; color?: Color; foreman?: boolean }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // The name is saved when the box is left (or Done is pressed), not on every key.
  const [name, setName] = useState(crewMember.name);
  const saveName = () => {
    if (name.trim() === '') setName(crewMember.name); // a Crew Member must have a name
    else onChange({ name });
  };

  return (
    <Panel title={crewMember.name} onClose={onClose}>
      <Field label="Name" value={name} onChange={setName} onLeave={saveName} />
      <ColorPicker value={crewMember.color} onPick={(color) => onChange({ color })} />
      <ForemanBox checked={crewMember.foreman} onChange={(foreman) => onChange({ foreman })} />
      <div className="settings-buttons">
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            saveName();
            onClose();
          }}
        >
          Done
        </button>
      </div>
      <RemoveBox
        label={`Remove ${crewMember.name}`}
        warning={`Remove ${crewMember.name}? They will no longer appear on the Daily Schedule.`}
        onRemove={onRemove}
      />
    </Panel>
  );
}

function NewCrewMemberPanel({
  onAdd,
  onClose,
}: {
  onAdd: (details: { name: string; color: Color; foreman: boolean }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<Color>('blue');
  const [foreman, setForeman] = useState(false);

  return (
    <Panel title="Add a Crew Member" onClose={onClose}>
      <Field label="Name" value={name} onChange={setName} autoFocus />
      <ColorPicker value={color} onPick={setColor} />
      <ForemanBox checked={foreman} onChange={setForeman} />
      <div className="settings-buttons">
        <button
          type="button"
          className="button button-primary"
          disabled={name.trim() === ''}
          onClick={() => onAdd({ name, color, foreman })}
        >
          Add
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Panel>
  );
}

function JobPanel({
  job,
  position,
  of,
  onChange,
  onMove,
  onRemove,
  onClose,
}: {
  job: Job;
  position: number;
  of: number;
  onChange: (changes: { name?: string; jobNumber?: string }) => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // Like a Crew Member's name, these are saved when the box is left or on Done.
  const [name, setName] = useState(job.name);
  const [jobNumber, setJobNumber] = useState(job.jobNumber ?? '');
  const save = () => {
    const kept = name.trim() === '' ? job.name : name; // a Job must have a name
    setName(kept);
    onChange({ name: kept, jobNumber });
  };

  return (
    <Panel title={jobLabel(job)} onClose={onClose}>
      <Field label="Name" value={name} onChange={setName} onLeave={save} />
      <Field
        label="Job number (you can leave this empty)"
        value={jobNumber}
        onChange={setJobNumber}
        onLeave={save}
      />
      <div className="settings-field">
        <span className="settings-label">
          Place on the Daily Schedule: {position} of {of}
        </span>
        <div className="settings-buttons">
          <button
            type="button"
            className="button"
            disabled={position === 1}
            onClick={() => onMove('up')}
          >
            <span aria-hidden="true">▲</span> Move up
          </button>
          <button
            type="button"
            className="button"
            disabled={position === of}
            onClick={() => onMove('down')}
          >
            <span aria-hidden="true">▼</span> Move down
          </button>
        </div>
      </div>
      <div className="settings-buttons">
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            save();
            onClose();
          }}
        >
          Done
        </button>
      </div>
      <RemoveBox
        label={`Remove ${jobLabel(job)}`}
        warning={`Remove ${jobLabel(job)}? Anyone placed on it will be Not Placed.`}
        onRemove={onRemove}
      />
    </Panel>
  );
}

function NewJobPanel({
  onAdd,
  onClose,
}: {
  onAdd: (details: { name: string; jobNumber: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [jobNumber, setJobNumber] = useState('');

  return (
    <Panel title="Add a Job" onClose={onClose}>
      <Field label="Name" value={name} onChange={setName} autoFocus />
      <Field
        label="Job number (you can leave this empty)"
        value={jobNumber}
        onChange={setJobNumber}
      />
      <div className="settings-buttons">
        <button
          type="button"
          className="button button-primary"
          disabled={name.trim() === ''}
          onClick={() => onAdd({ name, jobNumber })}
        >
          Add
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Panel>
  );
}
