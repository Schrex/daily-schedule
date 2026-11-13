import { createTestHarness } from 'wrangler';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import type { Env } from '../app';
import type { D1Database } from '../d1';

/**
 * A real local D1 for the tests, migrated from migrations/ like the deployed
 * one, and emptied before each test. Wrangler's test harness runs a tiny
 * Worker (d1-only.ts) only to own the database; the tests call the Worker's
 * `handle()` in Node with that database in its environment.
 *
 * Call it at the top of a test file. `env()` gives an environment for
 * `handle()`; `people` are put on the access list before each test.
 */
export function localD1(people: Record<string, 'editor' | 'viewer'> = {}) {
  const harness = createTestHarness({
    workers: [
      {
        config: {
          name: 'd1-only',
          main: './worker/src/testing/d1-only.ts',
          compatibility_date: '2026-11-10',
          d1_databases: [
            { binding: 'DB', database_name: 'daily-schedule', database_id: 'local', migrations_dir: './migrations' },
          ],
        },
      },
    ],
  });
  let db: D1Database | undefined;

  beforeAll(async () => {
    await harness.listen();
    await harness.getWorker().applyD1Migrations('DB');
    db = (await harness.getWorker<{ DB: D1Database }>().getEnv()).DB;
  }, 60_000);
  afterAll(() => harness.close());
  beforeEach(async () => {
    const DB = database();
    await DB.batch([
      ...['roster', 'schedules', 'people', 'settings'].map((table) => DB.prepare(`DELETE FROM ${table}`)),
      ...Object.entries(people).map(([email, role]) =>
        DB.prepare('INSERT INTO people (email, role) VALUES (?, ?)').bind(email, role),
      ),
    ]);
  });

  const database = (): D1Database => {
    if (!db) throw new Error('The local D1 is not started yet (use it inside a test).');
    return db;
  };

  /** An environment for the Worker's `handle()`, with the local D1. */
  const env = (vars: Partial<Env> = {}): Env => ({
    ASSETS: { fetch: async () => new Response('page') },
    DB: database(),
    ...vars,
  });

  return { env };
}
