import { describe, expect, it, vi } from 'vitest';
import type { Fetch } from '../storage/apiStore';
import { DeliveryFailure } from './index';
import { crewDelivery, serverDelivery } from './serverDelivery';

const picture = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

/** A stand-in for the network: answers each request as told, recording what was asked. */
function network(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => answer(url, init));
  return { fetchFn: fetchFn as Fetch, calls: fetchFn.mock.calls };
}

describe('sending through the Daily Schedule\'s server', () => {
  it('posts the picture and its title to the server\'s Send, and nothing else', async () => {
    const { fetchFn, calls } = network(() => new Response(null, { status: 204 }));
    await serverDelivery(fetchFn).deliver(picture, 'Schedule for Friday, Nov 13');

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    const headers = new Headers(init!.headers);
    expect(url).toBe('/daily-schedule/api/send');
    expect(init!.method).toBe('POST');
    expect(init!.body).toBe(picture);
    expect(headers.get('Content-Type')).toBe('image/png');
    expect(decodeURIComponent(headers.get('X-Title')!)).toBe('Schedule for Friday, Nov 13');
    // The send key and the channel are the server's business, never the page's.
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Channel')).toBe(false);
  });

  it('leaves nothing for the Scheduler to do after a Send', () => {
    expect(serverDelivery(network(() => new Response(null, { status: 204 })).fetchFn).nextStep).toBe('');
  });

  it('fails in the server\'s own words', async () => {
    const { fetchFn } = network(() =>
      Response.json({ error: 'The Daily Schedule bot is not in that Slack channel.' }, { status: 502 }),
    );
    const sending = serverDelivery(fetchFn).deliver(picture, 'x');

    await expect(sending).rejects.toBeInstanceOf(DeliveryFailure);
    await expect(sending).rejects.toThrow('The Daily Schedule bot is not in that Slack channel.');
    await expect(sending).rejects.toThrow('Nothing was sent.');
  });

  it('fails plainly when the server cannot be reached', async () => {
    const { fetchFn } = network(() => {
      throw new TypeError('Failed to fetch');
    });
    const sending = serverDelivery(fetchFn).deliver(picture, 'x');

    await expect(sending).rejects.toBeInstanceOf(DeliveryFailure);
    await expect(sending).rejects.toThrow('could not be reached, so nothing was sent');
  });
});

describe('choosing how the picture reaches the crew', () => {
  it('sends through the server when the server says Slack is connected', async () => {
    const { fetchFn, calls } = network((url) =>
      url.endsWith('/slack') ? Response.json({ connected: true }) : new Response(null, { status: 204 }),
    );
    const delivery = await crewDelivery(fetchFn);

    expect(calls.map(([url]) => url)).toEqual(['/daily-schedule/api/slack']);
    expect(delivery.nextStep).toBe('');
    await delivery.deliver(picture, 'x');
    expect(calls[1]![0]).toBe('/daily-schedule/api/send');
  });

  it('copies the picture for pasting only when the server says Slack is not connected', async () => {
    const { fetchFn, calls } = network(() => Response.json({ connected: false }));
    const delivery = await crewDelivery(fetchFn);

    expect(delivery.nextStep).toBe('Paste in Slack');
    expect(calls).toHaveLength(1);
  });

  it('does not fall back to copying when the server could not say', async () => {
    const { fetchFn } = network(() => Response.json({ error: 'The database is away.' }, { status: 500 }));

    await expect(crewDelivery(fetchFn)).rejects.toThrow('The database is away.');
  });
});
