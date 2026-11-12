// Decides whether a push touches the Slack relay (worker/wrangler.toml and the
// relay's code in worker/src), so CI deploys the relay only when it changed.
//
// CLI:  node .github/scripts/relay-changed.mjs <before-sha> <after-sha>
// prints "true" or "false". An unknown or all-zero <before-sha> (a new branch,
// a force push) prints "true": when in doubt, deploy.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** True when any of the changed paths belongs to the relay. */
export function relayChanged(files) {
  return files.some(isRelayFile);
}

// The relay is its config and its two files (index.ts imports only relay.ts).
// Everything else in worker/src is the app's Worker (app.ts, api.ts,
// signIn.ts and the rest) or tests. If the relay ever imports another file,
// add it here.
const RELAY_FILES = ['worker/wrangler.toml', 'worker/src/index.ts', 'worker/src/relay.ts'];

function isRelayFile(path) {
  return RELAY_FILES.includes(path);
}

function changedFiles(before, after) {
  const out = execFileSync('git', ['diff', '--name-only', before, after], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [before, after] = process.argv.slice(2);
  let answer = true;
  if (before && after && !/^0+$/.test(before)) {
    try {
      answer = relayChanged(changedFiles(before, after));
    } catch {
      answer = true; // the old commit isn't available: deploy to be safe
    }
  }
  console.log(String(answer));
}
