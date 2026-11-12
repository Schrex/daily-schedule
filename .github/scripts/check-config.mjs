// Checks the Worker's Wrangler config before a deploy, so that a config not
// set up yet fails early with a plain message instead of deep inside Wrangler.
//
// CLI:
//   node .github/scripts/check-config.mjs <wrangler.jsonc>
//     Prints each problem and exits 1, or exits 0 when there is none.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseJsonc } from './preview-config.mjs';

/** The database_id wrangler.jsonc carries until the database is created (README, "Setting up the database"). */
export const PLACEHOLDER_DATABASE_ID = 'REPLACE_WITH_DATABASE_ID';

/** What is wrong with the config, one plain sentence each; empty when it is ready to deploy. */
export function configProblems(config) {
  return (config.d1_databases ?? [])
    .filter((database) => database.database_id === PLACEHOLDER_DATABASE_ID)
    .map(
      (database) =>
        `The D1 binding ${database.binding} in wrangler.jsonc still has the placeholder database_id ` +
        `${PLACEHOLDER_DATABASE_ID}. Create the database and put its id there first: see ` +
        '"Setting up the database (once)" in the README.',
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [file] = process.argv.slice(2);
  if (!file) {
    console.error('Usage: node .github/scripts/check-config.mjs <wrangler.jsonc>');
    process.exit(2);
  }
  const problems = configProblems(parseJsonc(readFileSync(file, 'utf8')));
  for (const problem of problems) console.error(`::error file=${file}::${problem}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
