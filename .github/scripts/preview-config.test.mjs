import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc, previewConfig, d1Databases } from './preview-config.mjs';

test('reads wrangler.jsonc with comments, trailing commas and URLs in strings', () => {
  const text = `{
    // a line comment
    "name": "daily-schedule", /* a block comment */
    "url": "https://example.com/a//b", // not a comment inside the string
    "quote": "say \\"hi\\" // still a string",
    "list": [1, 2,],
  }`;
  assert.deepEqual(parseJsonc(text), {
    name: 'daily-schedule',
    url: 'https://example.com/a//b',
    quote: 'say "hi" // still a string',
    list: [1, 2],
  });
});

test('the preview keeps its own workers.dev address even when production has none', () => {
  const out = previewConfig({ name: 'daily-schedule', workers_dev: false }, {});
  assert.equal(out.workers_dev, true);
});

test('the preview Worker has its own name', () => {
  const out = previewConfig({ name: 'daily-schedule', workers_dev: true }, {});
  assert.equal(out.name, 'daily-schedule-preview');
  assert.equal(out.workers_dev, true);
});

test('the preview points every D1 binding at the preview database, never production', () => {
  const config = {
    name: 'daily-schedule',
    d1_databases: [
      { binding: 'DB', database_name: 'daily-schedule', database_id: 'prod-id', migrations_dir: 'migrations' },
    ],
  };
  const out = previewConfig(config, { previewDatabaseId: 'preview-id' });
  assert.deepEqual(out.d1_databases, [
    { binding: 'DB', database_name: 'daily-schedule-preview', database_id: 'preview-id', migrations_dir: 'migrations' },
  ]);
  // The production config is left as it was.
  assert.equal(config.d1_databases[0].database_id, 'prod-id');
});

test('a config with D1 but no preview database id is refused', () => {
  const config = { name: 'daily-schedule', d1_databases: [{ binding: 'DB', database_id: 'prod-id' }] };
  assert.throws(() => previewConfig(config, {}), /PREVIEW_D1_DATABASE_ID/);
});

test('a config with more than one D1 binding is refused (one preview database only)', () => {
  const config = {
    name: 'daily-schedule',
    d1_databases: [
      { binding: 'A', database_id: '1' },
      { binding: 'B', database_id: '2' },
    ],
  };
  assert.throws(() => previewConfig(config, { previewDatabaseId: 'p' }), /one D1/);
});

test('lists the D1 databases to migrate by their real names, or none before D1 is added', () => {
  assert.deepEqual(d1Databases({ name: 'x' }), []);
  assert.deepEqual(d1Databases({ d1_databases: [] }), []);
  assert.deepEqual(
    d1Databases({ d1_databases: [{ binding: 'DB', database_name: 'daily-schedule', database_id: '1' }] }),
    ['daily-schedule'],
  );
});

test('refuses a D1 database with no name, so commands never fall back to the binding', () => {
  assert.throws(() => d1Databases({ d1_databases: [{ binding: 'DB', database_id: '1' }] }), /database_name/);
});
