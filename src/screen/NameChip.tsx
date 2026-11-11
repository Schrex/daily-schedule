import type { CrewMember } from '../schedule-rules';

/** The classes of a name's chip: a Foreman's top line is black; the one selected is ringed. */
export const nameClass = (crewMember: CrewMember, selected = false): string =>
  `name${crewMember.foreman ? ' name-foreman' : ''}${selected ? ' name-selected' : ''}`;

/**
 * What is inside a name's chip: its top line, a dot of the Crew Member's
 * color and the name, then their Person Tasks, if any, as bulleted lines.
 * The same on the board and on the copy lifted by a drag.
 */
export function NameLines({ crewMember, personTasks = [] }: { crewMember: CrewMember; personTasks?: string[] }) {
  return (
    <>
      <span className="name-head">
        <span className={`name-dot dot-${crewMember.color}`} aria-hidden="true" />
        <span className="name-text">{crewMember.name}</span>
      </span>
      {personTasks.length > 0 && (
        <span className="name-subs">
          {personTasks.map((task, index) => (
            <span key={index} className="name-sub">
              {task}
            </span>
          ))}
        </span>
      )}
    </>
  );
}
