import { describe, expect, it } from 'vitest';
import { ApiError } from '../storage/apiStore';
import { askWhoIsCalling, openingFor, type Caller } from './opening';

const editor: Caller = { kind: 'on-the-list', email: 'ann@example.test', role: 'editor' };
const viewer: Caller = { kind: 'on-the-list', email: 'tv@example.test', role: 'viewer' };
const stranger: Caller = { kind: 'not-on-the-list' };
const signedOut: Caller = { kind: 'not-signed-in' };

describe('what a page shows to whoever opens it', () => {
  it('opens the board and Settings for an editor', () => {
    expect(openingFor('board', editor)).toEqual({ kind: 'open' });
    expect(openingFor('settings', editor)).toEqual({ kind: 'open' });
    expect(openingFor('tv', editor)).toEqual({ kind: 'open' });
    expect(openingFor('crew', editor)).toEqual({ kind: 'open' });
  });

  it('sends a viewer from the board or Settings to the Crew Page', () => {
    expect(openingFor('board', viewer)).toEqual({ kind: 'go-to-crew-page' });
    expect(openingFor('settings', viewer)).toEqual({ kind: 'go-to-crew-page' });
  });

  it('opens the Crew Page and the Office TV for a viewer', () => {
    expect(openingFor('crew', viewer)).toEqual({ kind: 'open' });
    expect(openingFor('tv', viewer)).toEqual({ kind: 'open' });
  });

  it('tells someone not on the list that they have no access, on every page', () => {
    for (const page of ['board', 'settings', 'tv', 'crew'] as const) {
      expect(openingFor(page, stranger)).toEqual({ kind: 'no-access' });
    }
  });

  it('asks someone not signed in to sign in to the hub, on every page', () => {
    for (const page of ['board', 'settings', 'tv', 'crew'] as const) {
      expect(openingFor(page, signedOut)).toEqual({ kind: 'sign-in' });
    }
  });
});

describe('asking the API who is calling', () => {
  const answering = (status: number, body: unknown) => async () => Response.json(body, { status });

  it('gives the email and role of someone on the list', async () => {
    expect(await askWhoIsCalling(answering(200, { email: 'ann@example.test', role: 'editor' }))).toEqual(editor);
  });

  it('takes 401 to mean not signed in, and 403 not on the list', async () => {
    expect(await askWhoIsCalling(answering(401, { error: 'You are not signed in.' }))).toEqual(signedOut);
    expect(await askWhoIsCalling(answering(403, { error: 'No access.' }))).toEqual(stranger);
  });

  it('asks /daily-schedule/api/me', async () => {
    const asked: string[] = [];
    await askWhoIsCalling(async (url) => {
      asked.push(url);
      return Response.json({ email: 'ann@example.test', role: 'editor' });
    });

    expect(asked).toEqual(['/daily-schedule/api/me']);
  });

  it('fails with the server\'s words on any other answer, or when the server cannot be reached', async () => {
    await expect(askWhoIsCalling(answering(500, { error: 'Broken.' }))).rejects.toEqual(new ApiError('Broken.', 500));
    await expect(
      askWhoIsCalling(async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(askWhoIsCalling(answering(200, { email: 'ann@example.test', role: 'boss' }))).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
