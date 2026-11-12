import { describe, expect, it, vi } from 'vitest';
import { DeliveryFailure } from './index';
import { slackDelivery } from './slackDelivery';
import { slackIsSetUp } from './slackSettings';

const settings = { relayUrl: 'https://relay.example/ ', sendKey: ' key ', channel: 'c0chsmjffps' };
const picture = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

describe('sending to Slack through the relay', () => {
  it('posts the picture with the key, title and channel', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    await slackDelivery(settings, fetchImpl as unknown as typeof fetch).deliver(picture, 'Daily Schedule for Friday');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://relay.example/send');
    expect(headers.Authorization).toBe('Bearer key');
    expect(headers['X-Channel']).toBe('C0CHSMJFFPS');
    expect(decodeURIComponent(headers['X-Title']!)).toBe('Daily Schedule for Friday');
    expect(init.body).toBe(picture);
  });

  it("fails with the relay's own words", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ok: false, error: 'The bot is not in that channel.' }, { status: 502 }),
    );
    const sending = slackDelivery(settings, fetchImpl as unknown as typeof fetch).deliver(picture, 'x');
    await expect(sending).rejects.toBeInstanceOf(DeliveryFailure);
    await expect(sending).rejects.toThrow('The bot is not in that channel.');
  });

  it('fails plainly when the relay cannot be reached', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      slackDelivery(settings, fetchImpl as unknown as typeof fetch).deliver(picture, 'x'),
    ).rejects.toThrow('Slack could not be reached');
  });

  it('is set up only with an https address and a key', () => {
    expect(slackIsSetUp(settings)).toBe(true);
    expect(slackIsSetUp({ ...settings, sendKey: '' })).toBe(false);
    expect(slackIsSetUp({ ...settings, relayUrl: 'http://relay.example' })).toBe(false);
  });
});
