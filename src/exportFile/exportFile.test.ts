import { describe, expect, it } from 'vitest';
import type { DailySchedule, Roster } from '../schedule-rules';
import type { SlackSettings } from '../send/slackSettings';
import { memoryStore } from '../storage/memoryStore';
import { exportFileName, exportFrom } from './index';

const roster: Roster = {
  crewMembers: [
    { id: 'ann', name: 'Ann', color: 'blue', foreman: true },
    { id: 'bob', name: 'Bob', color: 'orange', foreman: false },
  ],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};

const schedules: DailySchedule[] = [
  {
    date: '2026-11-05',
    placements: [{ crewMemberId: 'ann', destination: { kind: 'job', jobId: 'cobblestone' }, order: 1 }],
    tasks: { cobblestone: ['Strip topsoil'] },
    sends: [{ sentAt: '2026-11-04T22:00:00.000Z', sent: { date: '2026-11-05', jobs: [], standingRows: [] } as never }],
  },
  { date: '2026-11-06', placements: [], tasks: {}, sends: [], dayNotes: ['Rain day'] },
];

const slack: SlackSettings = {
  relayUrl: 'https://daily-schedule-slack.example.workers.dev',
  sendKey: 'a-send-key',
  channel: 'C0CHSMJFFPS',
};

describe('the Export file (downloaded at the old address)', () => {
  it('holds the Roster, every Daily Schedule earliest first, and the Slack settings', async () => {
    const old = memoryStore();
    await old.saveRoster(roster);
    for (const schedule of [...schedules].reverse()) await old.saveSchedule(schedule);

    expect(await exportFrom(old, slack)).toEqual({
      kind: 'daily-schedule-export',
      version: 1,
      roster,
      schedules,
      slack,
    });
  });

  it('holds no Roster when the old address never saved one', async () => {
    const file = await exportFrom(memoryStore(), slack);

    expect(file.roster).toBeNull();
    expect(file.schedules).toEqual([]);
  });

  it('is named after the day it was downloaded', () => {
    expect(exportFileName('2026-11-12')).toBe('daily-schedule-2026-11-12.json');
  });
});
