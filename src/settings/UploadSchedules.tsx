import { useState, type ChangeEvent } from 'react';
import { uploadExportFile } from '../exportFile';
import { signedInFetch } from '../signIn/openPage';

/** The query the page reloads with after an upload: how many Daily Schedules were saved. */
const UPLOADED = 'uploaded';

/**
 * "Upload the Export file": moves the Export file downloaded at the old
 * address into this one. The Worker replaces the Roster and every Daily
 * Schedule, and the Slack settings are saved on this computer. The page then
 * reloads, so nothing on it still holds the Roster from before, and says what
 * was saved. Refused once a Daily Schedule has been Sent from here.
 */
export function UploadSchedules() {
  const [message, setMessage] = useState<{ text: string; problem: boolean } | null>(() => {
    const saved = new URLSearchParams(window.location.search).get(UPLOADED);
    if (saved === null) return null;
    const count = Number(saved);
    return {
      text: `Saved ${count} Daily Schedule${count === 1 ? '' : 's'}. The Roster was replaced, and the Slack settings were saved on this computer.`,
      problem: false,
    };
  });
  const [busy, setBusy] = useState(false);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const { schedules } = await uploadExportFile(await file.text(), { fetch: signedInFetch });
      const url = new URL(window.location.href);
      url.searchParams.set(UPLOADED, String(schedules));
      window.location.replace(url);
    } catch (error) {
      setMessage({ text: `Not uploaded. ${error instanceof Error ? error.message : String(error)}`, problem: true });
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="upload-heading">
      <h2 id="upload-heading">Export file from the old address</h2>
      <p className="settings-hint">
        Upload the Export file downloaded at daily-schedule.schrex.workers.dev. It replaces the Roster and every
        Daily Schedule here, and brings the Slack settings. Once a Daily Schedule has been Sent from here, it is
        refused.
      </p>
      <div className="settings-buttons">
        <label className="button" aria-disabled={busy}>
          {busy ? 'Uploading…' : 'Upload the Export file'}
          <input type="file" accept="application/json,.json" hidden disabled={busy} onChange={upload} />
        </label>
      </div>
      {message && (
        <p className="settings-hint" role={message.problem ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
