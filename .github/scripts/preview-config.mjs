// Turns the Worker's Wrangler config into the PR preview's config: a separate
// Worker ("daily-schedule-preview") whose D1 binding points at a separate
// preview database, so a preview never reads or writes production data, and
// without the Slack relay's address, so a preview never posts to the crew.
//
// CLI:
//   node .github/scripts/preview-config.mjs write <in> <out>
//     Writes the preview config (plain JSON) to <out>. Put <out> in the same
//     folder as <in>, since paths in the config are relative to it.
//     Needs PREVIEW_D1_DATABASE_ID once the config has a D1 binding.
//   node .github/scripts/preview-config.mjs databases <in>
//     Prints each D1 database's real name (database_name), one per line
//     (nothing before D1 exists). Commands use these names, never the binding.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PREVIEW_NAME_SUFFIX = '-preview';

/** Parses JSON with comments and trailing commas (wrangler.jsonc). */
export function parseJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      // Copy a whole string, honouring escapes.
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  // Then drop trailing commas, again skipping over strings.
  return JSON.parse(stripTrailingCommas(out));
}

function stripTrailingCommas(json) {
  let out = '';
  let i = 0;
  while (i < json.length) {
    const c = json[i];
    if (c === '"') {
      let j = i + 1;
      while (j < json.length && json[j] !== '"') j += json[j] === '\\' ? 2 : 1;
      out += json.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === ',') {
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] === '}' || json[j] === ']') {
        i++;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * The real names of the D1 databases in a config ([] before D1 is added).
 * Every command uses these (e.g. `daily-schedule`), never the binding (`DB`),
 * so the same name works everywhere: here, in the dashboard and in a terminal.
 */
export function d1Databases(config) {
  return (config.d1_databases ?? []).map((db) => {
    if (!db.database_name) throw new Error(`The D1 binding ${db.binding} has no database_name; give it its real name.`);
    return db.database_name;
  });
}

/** A copy of the config for the preview Worker and the preview database. */
export function previewConfig(config, { previewDatabaseId }) {
  const out = structuredClone(config);
  const previewName = `${config.name}${PREVIEW_NAME_SUFFIX}`;
  out.name = previewName;
  if (out.topLevelName) out.topLevelName = previewName;
  // Production has no workers.dev address (only the hub forwards to it); a
  // preview is reached only at its own workers.dev address, so it keeps one.
  out.workers_dev = true;
  // A preview never posts to the crew's Slack channel: it is not told where
  // the Slack relay is (and, as a separate Worker, has no send key either),
  // so its Send copies the picture instead.
  if (out.vars) delete out.vars.SLACK_RELAY_URL;
  const dbs = out.d1_databases ?? [];
  if (dbs.length > 1) {
    throw new Error('The preview supports one D1 database; add a preview database id per binding first.');
  }
  if (dbs.length === 1) {
    if (!previewDatabaseId) {
      throw new Error(
        'The config has a D1 binding but PREVIEW_D1_DATABASE_ID is not set; refusing to preview against production data.',
      );
    }
    dbs[0].database_id = previewDatabaseId;
    if ('database_name' in dbs[0]) dbs[0].database_name = `${dbs[0].database_name}${PREVIEW_NAME_SUFFIX}`;
    delete dbs[0].preview_database_id;
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, input, output] = process.argv.slice(2);
  const config = parseJsonc(readFileSync(input, 'utf8'));
  if (command === 'databases') {
    for (const name of d1Databases(config)) console.log(name);
  } else if (command === 'write') {
    const preview = previewConfig(config, { previewDatabaseId: process.env.PREVIEW_D1_DATABASE_ID });
    writeFileSync(output, JSON.stringify(preview, null, 2));
    console.log(`Wrote ${output} for the Worker "${preview.name}".`);
  } else {
    console.error('usage: preview-config.mjs write <in> <out> | databases <in>');
    process.exit(2);
  }
}
