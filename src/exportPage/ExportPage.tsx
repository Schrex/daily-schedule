import { useEffect, useState } from 'react';
import { exportFileName, exportFrom } from '../exportFile';
import { scheduleDateOf } from '../schedule-rules';
import type { SlackSettings } from '../send/slackSettings';
import type { ScheduleStore } from '../storage';

/** Where the Daily Schedule lives now. */
export const NEW_ADDRESS = 'https://app.schreiberexcavating.com/daily-schedule/';

/**
 * The old address's only page: a notice that the Daily Schedule has moved,
 * with a link, and "Download this computer's schedules", which saves this
 * computer's Roster, Daily Schedules and Slack settings as an Export file: a
 * backup and a reference. The new address doesn't take the file; the data
 * there is entered in the app itself.
 */
export function ExportPage({ store, slack }: { store: ScheduleStore; slack: SlackSettings }) {
  const [count, setCount] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    store.listScheduleDates().then(
      (dates) => setCount(dates.length),
      (error) => setProblem(`Could not read this computer's schedules: ${String(error)}`),
    );
  }, [store]);

  const download = async () => {
    try {
      const file = await exportFrom(store, slack);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = exportFileName(scheduleDateOf(new Date()));
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      setProblem(`Could not make the file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="settings">
      <h1>The Daily Schedule has moved</h1>
      <p className="settings-intro">
        It now lives at <a href={NEW_ADDRESS}>{NEW_ADDRESS}</a>, shared by every computer, phone and the Office TV.
        Nothing can be changed here any more.
      </p>

      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Keep a copy of your schedules</h2>
        <p className="settings-hint">
          {count === null
            ? 'Looking for the schedules saved on this computer…'
            : count === 0
              ? 'No Daily Schedules are saved on this computer.'
              : `${count} Daily Schedule${count === 1 ? ' is' : 's are'} saved on this computer, with the Roster and the Slack settings.`}
        </p>
        <p className="settings-hint">
          Download the Export file to keep as a backup. The new address doesn&apos;t read it: enter the Roster
          and the Daily Schedules there in the app.
        </p>
        <div className="settings-buttons">
          <button type="button" className="button button-primary" onClick={download}>
            Download this computer&apos;s schedules
          </button>
        </div>
        {problem && (
          <p className="settings-hint" role="alert">
            {problem}
          </p>
        )}
      </section>
    </main>
  );
}
