import { describe, expect, it } from 'vitest';
import { slackIsSetUp } from './slackSettings';

const settings = { relayUrl: 'https://relay.example/ ', sendKey: ' key ', channel: 'c0chsmjffps' };

describe('the Slack settings kept in a browser', () => {
  it('are set up only with an https address and a key', () => {
    expect(slackIsSetUp(settings)).toBe(true);
    expect(slackIsSetUp({ ...settings, sendKey: '' })).toBe(false);
    expect(slackIsSetUp({ ...settings, relayUrl: 'http://relay.example' })).toBe(false);
  });
});
