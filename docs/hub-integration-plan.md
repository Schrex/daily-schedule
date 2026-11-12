# Plan: the Daily Schedule inside the hub

Status, 2026-11-12: **planned, nothing built.** Issue #55 has been revised after a review.
Next steps: move DNS to Cloudflare (step 1). Building #55 (step 2) can start at the same time.

"The hub" is the company's main web app at app.schreiberexcavating.com
(repository `Schrex/schreiber-hub-central`: React on Cloudflare Pages, data and sign-in in Supabase).

## The goal

- The hub's "Schedule" buttons open the Daily Schedule.
- The Daily Schedule stays a separate app. The Scheduler deploys it alone, in minutes.
  Many changes will be built in Claude cloud sessions.
- The hub's Supabase data is not changed.
- This is the **first app of a company pattern**: later apps follow the same setup.

## The company pattern for apps

```
                         Cloudflare DNS  (schreiberexcavating.com)
                                   │
          ┌────────────────────────┼─────────────────────────────┐
          ▼                        ▼                             ▼
   www / apex              app.schreiberexcavating.com      mail records
   Wix website                     │                        (unchanged)
   (unchanged)          ┌──────────┼───────────┬────────────────┐
                        ▼          ▼           ▼                ▼
                     /*         /daily-     /<app>/*        /<app>/*
                     HUB        schedule/*  (future)        (future)
                     Pages      Worker + D1 Worker + D1     Worker + D1
                        │          │           │                │
                        ▼          └───────────┴────────────────┘
                     Supabase  ◀── every app checks the same hub sign-in token
```

- **Each app has its own:** repository, Worker, D1 database, path under app.schreiberexcavating.com, and deploys.
- **All apps share:** the domain, the hub sign-in, and a tile in the hub.
- **Data the whole company shares** (employees, jobs) stays in the hub. Apps never keep a hand-made copy.
  They read it from the hub later, when they need it.
- **Trade-off:** all apps share one address. That gives a free shared sign-in, but a bug in one app could read
  the hub sign-in token. This is fine for internal apps that the team reviews. If the apps become many,
  or include outside code, move each one to its own subdomain with a domain-wide sign-in cookie.

## Decisions made

1. **DNS moves to Cloudflare.** Today Wix hosts the DNS, so Cloudflare has no zone and no Worker route
   is possible. Moving DNS is a one-time job. After it, every new app is configuration only. Ownership
   of the domain stays at Wix.
   (Rejected: the hub forwarding the path. That needs a hub release for each new app.)
2. **Separate app at one hub path:** `app.schreiberexcavating.com/daily-schedule/`, through a Worker route.
3. **Own database:** Cloudflare D1, free plan. The Roster and each Daily Schedule are stored as JSON.
4. **Hub sign-in, no second login.** The app reads the hub's Supabase session on the shared address
   and refreshes it, using `supabase-js` for sign-in only. The Worker checks the token against the hub's
   public keys. The app never reads or writes hub data.
5. **Own access list in D1.** Editors use the Scheduler's screen. Viewers get the Office TV page.
6. **Replace the hub's `/schedule` page** (nobody uses it now). It is parked, not deleted.
7. **Hub features that use the old schedule data are for later** (see "Later" below).
8. **Ship through a pipeline:** tests on every PR, preview deploys, automatic deploy on merge.
   This is the safety net for changes built in Claude cloud sessions.
   (Considered and rejected: copying the app into the hub. That puts every change through the hub's
   release process, needs Supabase migrations, and means a port to React 18 and Tailwind.)

## The sequence

- [ ] **1. Move DNS to Cloudflare** (once, about one day, with whoever has the Wix account). See the checklist below.
- [ ] **2. Build issue #55**: https://github.com/Schrex/daily-schedule/issues/55
      D1, hub sign-in, editors and viewers, save queue, export and import file, relay accepts both addresses.
      The code can be built before step 1 is finished. Only the production route waits for it.
- [ ] **3. CI pipeline** (its own issue): tests on every PR, preview deploys, automatic deploy on merge,
      and D1 migrations applied by CI. Keep the Cloudflare token in GitHub secrets.
- [ ] **4. Move the data.** At the OLD address, the Scheduler pushes "Download this computer's schedules".
      At the NEW address, they upload the file. Before sending anything new, they check the board and Send to Slack.
- [ ] **5. Hub changes** (see below), in the hub repository, through its release process.
- [ ] **6. Make this repository the template** for the next app.
- [ ] **7. Later:** the hub features that use the old schedule data.

## Warnings

1. **Keep the order.** If the hub's `/schedule` redirect ships before step 2 is live, the Schedule button
   opens an empty page.
2. **Move the data with the file.** Browser storage is attached to one address. The new address can't see
   the old data, and the old address has no hub sign-in. So: download the file at the old address, then
   upload it at the new address.
3. **Upload before the first Send at the new address.** After a Daily Schedule has been Sent at the new
   address, the import is refused, so that it can't overwrite real work.

## Step 1 checklist: move DNS to Cloudflare

Do this with whoever has the Wix account. **First** check that two people at the company can sign in to
that Wix account, that auto-renew is on, and that the transfer lock is on. This protects the domain itself.

1. At Wix, confirm that you can change the nameservers for this domain.
2. Make a list of every DNS record at Wix: MX (mail), SPF, DKIM, DMARC, the website (apex and www),
   the `app` CNAME, and every verification record.
3. Add the domain to Cloudflare (free plan). Compare Cloudflare's scanned records with the Wix list,
   line by line.
4. Set every record to "DNS only" (grey cloud) at first, so that nothing behaves differently.
5. Change the nameservers at Wix, outside working hours.
6. Check at once: send and receive an email, open the website, open the hub and sign in.
7. To undo: put the Wix nameservers back. The Wix records are still there.
8. After it is stable: check that a Worker route on `app.schreiberexcavating.com/daily-schedule/*`
   takes precedence over the hub's Pages custom domain.

## Check before building #55

- Does Cloudflare's Workers Vitest integration work with this repository's Vitest version?
  If not, run a local D1 through Miniflare directly in the tests.
- Who creates the Office TV's hub account, and with which hub role?
  (Default: a dedicated account with the lowest hub role, listed as a viewer.)

## Hub changes (step 5)

Rules of the hub repository: work on a `feature/*` branch from `develop`, never commit to `main`,
and read its `CLAUDE.md` first. Merging to `main` doesn't deploy; releases are approved by the owner.

1. Change the `/schedule` route (in `src/App.tsx`) to a small component that does
   `window.location.replace('/daily-schedule/')`.
   - **Do not** only change the links. The home tile (`src/pages/Index.tsx`) and the bottom menu
     (`src/components/BottomNav.tsx`) use React Router `navigate()`. That stays inside the hub and
     shows the hub's "Not found" page.
   - A real page load reaches the Worker. `replace` means Back goes to the hub home.
   - This one route change covers all four links to `/schedule`: the home tile, the bottom menu,
     Job Lookahead, and the Whiteboard back button.
2. Add a switch in `src/lib/launchScope.ts` (like `integrationsParked`), so that the old page can be
   switched on again.
3. Add the Schedule page to `parked/README.md`: what is parked and how to restore it.
4. Keep the old `Schedule.tsx` code and the `schedule_assignments` table. Delete nothing.
5. Leave `/schedule/whiteboard` as it is for now.
6. Optional: let the hub's sign-in page go back to a `?next=` path on the same address. Today it always
   goes to `/`. With this change, people who sign in from the Daily Schedule return to it.

Undo: switch the flag back on. The old page and its data return.

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
  static files don't count. CPU limit: 10 ms per request; waiting on the database doesn't count.
- **D1:** 5 million rows read and 100,000 rows written a day, 500 MB per database, 7 days of Time Travel.
- **Expected use:** about 7,000 requests a day, mostly the Office TV checking once a minute.
- Going over a limit makes requests fail until midnight UTC; it doesn't add charges. The paid plan is $5 a month.
