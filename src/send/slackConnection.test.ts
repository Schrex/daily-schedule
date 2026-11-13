import { describe, expect, it, vi } from 'vitest';
import type { Fetch } from '../storage/apiStore';
import { changeSlackChannel, loadSlackConnection } from './slackConnection';

/** A stand-in for the network: answers each request as told, recording what was asked. */
function network(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => answer(url, init));
  return { fetchFn: fetchFn as Fetch, calls: fetchFn.mock.calls };
}

describe('Slack, as the server has it', () => {
  it('reads whether Slack is connected and the channel from the server', async () => {
    const { fetchFn, calls } = network(() => Response.json({ connected: true, channel: 'C0TESTCHANNEL' }));

    expect(await loadSlackConnection(fetchFn)).toEqual({ connected: true, channel: 'C0TESTCHANNEL' });
    expect(calls.map(([url]) => url)).toEqual(['/daily-schedule/api/slack']);
  });

  it('takes a server that names no channel to have none', async () => {
    const { fetchFn } = network(() => Response.json({ connected: false }));

    expect(await loadSlackConnection(fetchFn)).toEqual({ connected: false, channel: '' });
  });

  it('asks the server to change the channel for everyone', async () => {
    const { fetchFn, calls } = network(() => new Response(null, { status: 204 }));
    await changeSlackChannel('C0TESTCHANNEL', fetchFn);

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toBe('/daily-schedule/api/slack');
    expect(init!.method).toBe('PUT');
    expect(JSON.parse(init!.body as string)).toEqual({ channel: 'C0TESTCHANNEL' });
  });

  it('fails in the server\'s own words when the channel is refused', async () => {
    const { fetchFn } = network(() => Response.json({ error: 'A channel ID looks like C0CHSMJFFPS.' }, { status: 400 }));

    await expect(changeSlackChannel('#crew', fetchFn)).rejects.toThrow('A channel ID looks like C0CHSMJFFPS.');
  });
});
