/**
 * How to reach Slack: the Slack relay's address, the send key it asks for, and
 * the channel the picture goes to. Kept in browser storage on the Scheduler's
 * computer, set on the settings page. The Slack token itself is never here:
 * it stays in the relay.
 */
export interface SlackSettings {
  /** The relay's address, e.g. https://daily-schedule-slack.example.workers.dev */
  relayUrl: string;
  /** The send key the relay was given. */
  sendKey: string;
  /** The Slack channel ID (C0…). Empty: the relay's own channel. */
  channel: string;
}

const KEY = 'daily-schedule/slack';

export const emptySlackSettings: SlackSettings = { relayUrl: '', sendKey: '', channel: '' };

export function loadSlackSettings(storage: Storage = window.localStorage): SlackSettings {
  try {
    const saved = storage.getItem(KEY);
    if (saved === null) return emptySlackSettings;
    const parsed = JSON.parse(saved) as Partial<SlackSettings>;
    return {
      relayUrl: typeof parsed.relayUrl === 'string' ? parsed.relayUrl : '',
      sendKey: typeof parsed.sendKey === 'string' ? parsed.sendKey : '',
      channel: typeof parsed.channel === 'string' ? parsed.channel : '',
    };
  } catch {
    return emptySlackSettings;
  }
}

export function saveSlackSettings(settings: SlackSettings, storage: Storage = window.localStorage): void {
  storage.setItem(KEY, JSON.stringify(cleanSlackSettings(settings)));
}

/** Without stray spaces, and the address without a trailing slash. */
export function cleanSlackSettings(settings: SlackSettings): SlackSettings {
  return {
    relayUrl: settings.relayUrl.trim().replace(/\/+$/, ''),
    sendKey: settings.sendKey.trim(),
    channel: settings.channel.trim().toUpperCase(),
  };
}

/** Slack is set up once the relay's address and the send key are both there. */
export function slackIsSetUp(settings: SlackSettings): boolean {
  const clean = cleanSlackSettings(settings);
  return /^https:\/\/\S+$/.test(clean.relayUrl) && clean.sendKey !== '';
}

/** A channel ID looks like C0CHSMJFFPS; empty is allowed (the relay's own channel). */
export function channelLooksRight(channel: string): boolean {
  const clean = channel.trim().toUpperCase();
  return clean === '' || /^[CG][A-Z0-9]{6,}$/.test(clean);
}
