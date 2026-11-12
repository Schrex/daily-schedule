import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relayChanged } from './relay-changed.mjs';

test('a change to the relay code deploys the relay', () => {
  assert.equal(relayChanged(['worker/src/relay.ts']), true);
  assert.equal(relayChanged(['worker/src/index.ts']), true);
});

test("a change to the relay's configuration deploys the relay", () => {
  assert.equal(relayChanged(['worker/wrangler.toml']), true);
});

test("changes to the screen, the app's Worker or tests leave the relay alone", () => {
  assert.equal(
    relayChanged([
      'src/screen/selection.ts',
      'worker/src/app.ts',
      'worker/src/app-index.ts',
      'worker/src/app.test.ts',
      'worker/src/api.ts',
      'worker/src/signIn.ts',
      'worker/src/d1.ts',
      'worker/src/testing/localD1.ts',
      'worker/src/relay.test.ts',
      'migrations/0001_roster_schedules_people.sql',
      'wrangler.jsonc',
      'README.md',
    ]),
    false,
  );
});

test('no changes leave the relay alone', () => {
  assert.equal(relayChanged([]), false);
});
