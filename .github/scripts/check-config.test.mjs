import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configProblems } from './check-config.mjs';

const withDatabaseId = (id) => ({
  name: 'daily-schedule',
  d1_databases: [{ binding: 'DB', database_name: 'daily-schedule', database_id: id, migrations_dir: 'migrations' }],
});

test('the placeholder database_id stops the deploy with a plain message pointing at the README', () => {
  const problems = configProblems(withDatabaseId('REPLACE_WITH_DATABASE_ID'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /REPLACE_WITH_DATABASE_ID/);
  assert.match(problems[0], /README/);
  assert.match(problems[0], /DB/);
});

test('a real database_id passes', () => {
  assert.deepEqual(configProblems(withDatabaseId('0f2c6a1e-1234-4abc-9def-0123456789ab')), []);
});

test('a config with no D1 binding passes', () => {
  assert.deepEqual(configProblems({ name: 'daily-schedule' }), []);
});
