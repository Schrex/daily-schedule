# Plan: the Daily Schedule inside the hub

Status, 2026-11-12: **planned, nothing built.** Revised again the same day: the DNS move is dropped
(see "Why not move DNS"). The hub forwards one path to the Daily Schedule instead.
Next step: build issue #55 (step 1).

"The hub" is the company's main web app at app.schreiberexcavating.com
(repository `Schrex/schreiber-hub-central`: React on Cloudflare Pages project `schreiber-hub-preview`,
data and sign-in in Supabase). The hub's owner approved the change to the hub described below.

## The goal

- The hub's "Schedule" buttons open the Daily Schedule at `app.schreiberexcavating.com/daily-schedule/`.
- No second sign-in: the Daily Schedule uses the hub's sign-in.
- The Daily Schedule stays a separate app. The Scheduler deploys it alone, in minutes.
  Many changes will be built in Claude cloud sessions.
- The hub's Supabase data is not changed.
- This is the **first app of a company pattern**: later apps follow the same setup.

## How a request gets to the Daily Schedule

```
   Browser: app.schreiberexcavating.com/...
                      │
                      ▼
   DNS at Wix (unchanged): "app" → the hub's Pages project
                      │
                      ▼
   ┌───────────────────────────────────────────────────────┐
   │ HUB (Cloudflare Pages)                                │
   │                                                       │
   │   Forwarding function (one file, runs only on         │
   │   /daily-schedule and /daily-schedule/*)              │
   │        │                                              │
   │        │ service binding (private, Cloudflare only)   │
   └────────┼──────────────────────────────────────────────┘
            │                         every other path: the hub's static pages, as today
            ▼
   Worker "daily-schedule" + D1      ◀── checks the hub sign-in token itself
```

- **The forwarding function** is one small file in the hub. It passes the whole request (path, headers,
  body) to the `daily-schedule` Worker and returns the answer unchanged. It reads and keeps nothing.
- It runs **only** on `/daily-schedule` and `/daily-schedule/*` (set by `_routes.json`), so the rest of
  the hub stays static files and costs no function requests.
- The browser only sees `app.schreiberexcavating.com`, so the hub's saved sign-in is available to the app.
- The app's own deploys never touch the hub: the function always reaches the live Worker version.

## The company pattern for apps

- **Each app has its own:** repository, Worker, D1 database, path under app.schreiberexcavating.com, and deploys.
- **All apps share:** the address, the hub sign-in, the forwarding function, and a tile in the hub.
- **A new app needs one hub release:** one line in the function's list of apps, and one service binding
  in the hub's Pages settings. Changes to an existing app need no hub release.
  If new apps come often, the function can forward `/<name>/` to the Worker `<name>` without a list
  (the Workers then need public addresses).
- **Data the whole company shares** (employees, jobs) stays in the hub. Apps never keep a hand-made copy.
  They read it from the hub later, when they need it.
- **Trade-offs:**
  - All apps share one address. That gives a free shared sign-in, but a bug in one app could read
    the hub sign-in token. This is fine for internal apps that the team reviews.
  - If the hub is down, the apps behind it are down too.
  - If apps become many, or include outside code, move each one to its own subdomain.

## Decisions made

1. **The hub forwards one path.** The hub gets one forwarding function for `/daily-schedule`.
   The hub's release guard today allows static files only; it changes to allow **exactly this one
   function file** and nothing else. The owner approved this.
2. **No DNS change.** DNS stays at Wix. Wix, the company website and the domain are not touched.
3. **Separate app at one hub path:** `app.schreiberexcavating.com/daily-schedule/`. The hub's `/schedule`
   forwards there. `/schedule/whiteboard` stays a hub page.
4. **Own database:** Cloudflare D1, free plan. The Roster and each Daily Schedule are stored as JSON.
5. **Hub sign-in, no second login.** The app reads the hub's Supabase session on the shared address
   and refreshes it, using `supabase-js` for sign-in only. The Worker checks the token against the hub's
   public keys. The app never reads or writes hub data.
6. **Own access list in D1.** Editors use the Scheduler's screen. Viewers get the Office TV page.
7. **Replace the hub's `/schedule` page** (nobody uses it now). It is parked, not deleted.
8. **Hub features that use the old schedule data are for later** (see "Later" below).
9. **Ship through a pipeline:** tests on every PR, preview deploys, automatic deploy on merge.
   This is the safety net for changes built in Claude cloud sessions.

## Why not move DNS (rejected 2026-11-12)

The first version of this plan moved the domain's DNS from Wix to Cloudflare, so that a Worker route
could split the path. We tried it:

- The domain was bought at Wix and is connected to the Wix website by nameservers.
- Wix refuses a nameserver change until the domain is **unassigned from the website**, which takes the
  company website offline until it is connected again by "pointing".
- Wix's help pages don't say whether pointing works for a domain bought at Wix.

So the DNS move puts the public website at risk. The pending Cloudflare zone was deleted, and nothing
at Wix was changed. If DNS moves to Cloudflare one day for another reason, a Worker route can replace
the forwarding function; the apps don't change, because they keep the same paths.

Also rejected: a separate address such as `schedule.schreiberexcavating.com` (it needs a second sign-in
on each device), and copying the app into the hub (every change would go through the hub's release
process, with Supabase migrations and a port to React 18 and Tailwind).

## The sequence

- [ ] **1. Build issue #55**: https://github.com/Schrex/daily-schedule/issues/55
      D1, hub sign-in, editors and viewers, save queue, export and import file, relay accepts both addresses.
- [ ] **2. Hub change** (in the hub repository, through its release process; see below).
      Can be built at the same time as step 1, but **released after** step 1 is deployed.
- [ ] **3. Cloudflare setup** (once): create the D1 database, and add the service binding
      `DAILY_SCHEDULE` → Worker `daily-schedule` in the hub's Pages project settings.
- [ ] **4. Release:** deploy the Daily Schedule with #55, then release the hub.
      Check: the hub's Schedule button opens the board, with no second sign-in.
- [ ] **5. Move the data.** At the OLD address, the Scheduler pushes "Download this computer's schedules".
      At the NEW address, they upload the file. Before sending anything new, they check the board and Send to Slack.
      Then the Office TV is pointed at the new address.
- [ ] **6. CI pipeline** (its own issue): tests on every PR, preview deploys, automatic deploy on merge,
      and D1 migrations applied by CI. Keep the Cloudflare token in GitHub secrets.
- [ ] **7. Make this repository the template** for the next app.
- [ ] **8. Later:** the hub features that use the old schedule data.

## Warnings

1. **Keep the order.** If the hub release ships before #55 is deployed, the Schedule button opens an
   empty page.
2. **Move the data with the file.** Browser storage is attached to one address. The new address can't see
   the old data, and the old address has no hub sign-in. So: download the file at the old address, then
   upload it at the new address.
3. **Upload before the first Send at the new address.** After a Daily Schedule has been Sent at the new
   address, the import is refused, so that it can't overwrite real work.

## Check before building #55

- Does Cloudflare's Workers Vitest integration work with this repository's Vitest version?
  If not, run a local D1 through Miniflare directly in the tests.
- Who creates the Office TV's hub account, and with which hub role?
  (Default: a dedicated account with the lowest hub role, listed as a viewer.)

## Hub changes (step 2)

Rules of the hub repository: work on a `feature/*` branch from `develop`, never commit to `main`,
and read its `CLAUDE.md` first. Merging to `main` doesn't deploy; releases are approved by the owner.

1. **The forwarding function**, in `functions/daily-schedule/`: for `/daily-schedule` and
   `/daily-schedule/*`, return `env.DAILY_SCHEDULE.fetch(request)`. Nothing else.
2. **`_routes.json`** that includes only `/daily-schedule` and `/daily-schedule/*`, so every other path
   stays static and never runs a function.
3. **The release guard** (`scripts/release-policy.mjs`, `scripts/release-operation.mjs`): today it refuses
   `functions/`, `_worker.js`, `_routes.json` and any deployment that uses functions. Change it to allow
   **exactly** the approved function and `_routes.json` (checked by hash or exact content), and to refuse
   anything else. Update `scripts/release-operation.test.mjs` for both the allowed and the refused cases.
   Also check how the upload includes the compiled function.
4. Change the `/schedule` route (in `src/App.tsx`) to a small component that does
   `window.location.replace('/daily-schedule/')`.
   - **Do not** only change the links. The home tile (`src/pages/Index.tsx`) and the bottom menu
     (`src/components/BottomNav.tsx`) use React Router `navigate()`. That stays inside the hub and
     never reaches the forwarding function.
   - `replace` means Back goes to the hub home.
   - This one route change covers all four links to `/schedule`: the home tile, the bottom menu,
     Job Lookahead, and the Whiteboard back button.
5. Add a switch in `src/lib/launchScope.ts` (like `integrationsParked`), so that the old page can be
   switched on again.
6. Add the Schedule page to `parked/README.md`: what is parked and how to restore it.
7. Keep the old `Schedule.tsx` code and the `schedule_assignments` table. Delete nothing.
8. Leave `/schedule/whiteboard` as it is.
9. Update the hub's codebase map (`docs/codebase/`) and release docs for the function.
10. Optional: let the hub's sign-in page go back to a `?next=` path on the same address. Today it always
    goes to `/`. With this change, people who sign in from the Daily Schedule return to it.

Undo: switch the flag back on, and release the hub without the function. The old page and its data return.

## Later: hub features that use the old schedule data

The hub's old schedule saves placements in the Supabase table `schedule_assignments`.
These hub features use it. They are empty now, because nobody uses the old page:

| Hub feature | What it does with `schedule_assignments` |
| --- | --- |
| Jobs list | Counts people on each job today |
| Job page, Lookahead | Shows who is on this job this week |
| Safety, toolbox talk | Finds the foreman's job today and the crew who must sign |
| Whiteboard | Writes to it when a crew tile moves |
| Job status change | Deletes future placements when a job closes |

To feed them later, there are three options:

- **A. Sync (recommended).** The Daily Schedule sends Placements to a hub Edge Function, which writes
  `schedule_assignments`. The hub features stay as they are.
- **B. The hub reads the Daily Schedule API.** Four hub features change, and they then depend on the Worker.
- **C. Don't connect them.** Those features stay empty.

Options A and B need hub IDs in the Roster: `profiles.id` for a Crew Member and `jobs.id` for a Job.
So the Roster would then come from the hub, not be typed by hand.

Features the old hub schedule has that the Daily Schedule doesn't have yet:

- Crew Members see their own schedule on their phone
- Week view
- Time off
- Start time and role on the job
- Foremen can edit notes

For each one, decide whether to build it, replace it, or drop it.

## Free plan headroom

- **Workers:** 100,000 requests a day across the whole account. Pages Functions count toward the same limit;
  static files don't count. A request through the forwarding function counts twice (the function and the
  Worker). CPU limit: 10 ms per request; waiting on the database doesn't count.
- **D1:** 5 million rows read and 100,000 rows written a day, 500 MB per database, 7 days of Time Travel.
- **Expected use:** about 7,000 requests a day reach the Worker, mostly the Office TV checking once a minute,
  so about 14,000 counted requests with the function.
- Going over a limit makes requests fail until midnight UTC; it doesn't add charges. The paid plan is $5 a month.
