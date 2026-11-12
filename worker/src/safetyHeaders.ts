/**
 * The browser safety headers every answer from the Daily Schedule carries.
 *
 * The hub sends nosniff and the referrer policy on its own pages, but not on the
 * pages it forwards here, so the Worker adds them itself:
 *
 * - nosniff: a file is only ever taken as the type it is served as.
 * - The referrer policy: other sites are told only that a visitor came from the
 *   hub, never the full address (the day, the page).
 * - Framing (enforced): only the hub's own pages may show a Daily Schedule page
 *   inside theirs, so another site cannot lay its own buttons over the board.
 *   It is in its own enforced policy because browsers ignore frame-ancestors in
 *   a report-only one.
 * - The content security policy, report-only for now: the pages may run only
 *   their own scripts and talk only to the hub's sign-in and the Slack relay.
 *   Browsers report what it would have blocked to CSP_REPORT_PATH (logged by
 *   the Worker) without blocking anything. Once a few days of normal use show
 *   no reports, send it as Content-Security-Policy to enforce it.
 */

/** Where browsers send what the report-only policy would have blocked. */
export const CSP_REPORT_PATH = '/daily-schedule/csp-report';

/** The hub's Supabase sign-in, which the pages call (src/signIn/hubSession.ts). */
const HUB_SIGN_IN = 'https://acgqjjbrnkmeazswdnzp.supabase.co';

/**
 * The Slack relay, a separate Worker whose address is typed into Settings
 * (src/send/slackSettings.ts), so only its kind of address can be named.
 */
const SLACK_RELAY = 'https://*.workers.dev';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  // The logo, and the crew picture drawn on a canvas and shown or sent as a PNG.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${HUB_SIGN_IN} ${SLACK_RELAY}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // report-uri only: Chrome skips it whenever report-to is also set, and its
  // report-to reports were not seen to arrive (they are batched and may be dropped).
  `report-uri ${CSP_REPORT_PATH}`,
].join('; ');

const SAFETY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY,
};

/** The answer, with the safety headers added (the original's may be read-only). */
export function withSafetyHeaders(response: Response): Response {
  const safe = new Response(response.body, response);
  for (const [name, value] of Object.entries(SAFETY_HEADERS)) safe.headers.set(name, value);
  return safe;
}

/** The most a report may be: real ones are well under 2 KB. */
const MAX_REPORT_BYTES = 16 * 1024;

/**
 * Takes a browser's report of what the policy would have blocked and logs the
 * gist (Workers observability keeps the logs). Open to anyone, as browsers send
 * reports without the sign-in, so it only ever logs, briefly, and answers nothing.
 */
export async function handleCspReport(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_REPORT_BYTES) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_REPORT_BYTES) return new Response(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  for (const violation of violations(body).slice(0, 10)) {
    console.warn('CSP report-only violation', JSON.stringify(violation));
  }
  return new Response(null, { status: 204 });
}

interface Violation {
  page: string;
  directive: string;
  blocked: string;
}

/**
 * The violations in a report, in either shape browsers send: the older
 * report-uri one ({ "csp-report": { … } }) or the Reporting API's list.
 */
function violations(body: unknown): Violation[] {
  const raw = Array.isArray(body)
    ? body.filter((item) => item?.type === 'csp-violation').map((item) => item.body)
    : [(body as { 'csp-report'?: unknown })?.['csp-report']];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      page: brief(item.documentURL ?? item['document-uri']),
      directive: brief(item.effectiveDirective ?? item['effective-directive'] ?? item['violated-directive']),
      blocked: brief(item.blockedURL ?? item['blocked-uri']),
    }));
}

/** A field, as short plain text, an address without its query (which could carry a key). */
function brief(value: unknown): string {
  if (typeof value !== 'string') return '';
  let text = value;
  try {
    const url = new URL(value);
    text = url.origin + url.pathname;
  } catch {
    // Not an address: "inline", "eval", a directive name.
  }
  return text.slice(0, 200);
}
