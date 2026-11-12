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

function isRelayFile(path) {
  if (path === 'worker/wrangler.toml') return true;
  if (!path.startsWith('worker/src/')) return false;
  const name = path.slice('worker/src/'.length);
  // The app's Worker (app.ts, app-index.ts) and every test are not the relay.
  if (name.startsWith('app')) return false;
  if (/\.test\.[cm]?[jt]s$/.test(name)) return false;
  return true;
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
