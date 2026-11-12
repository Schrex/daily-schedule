# Plan: the Daily Schedule inside the hub

Status, 2026-11-12: **planned, nothing built.** Next step: build issue #55.

"The hub" is the company's main web app at app.schreiberexcavating.com
(repository `Schrex/schreiber-hub-central`: React on Cloudflare Pages, data and sign-in in Supabase).

## The goal

- The hub's "Schedule" buttons open the Daily Schedule.
- The Daily Schedule stays a separate app. The Scheduler deploys it alone, at any time.
- The hub's Supabase data is not changed.

## Decisions made

1. **Separate app at one hub path.** The Daily Schedule Worker is served at
   `app.schreiberexcavating.com/daily-schedule/` by a Cloudflare Worker route.
   All other paths still go to the hub on Cloudflare Pages.
2. **Own database: Cloudflare D1 (free plan).** The Roster and each Daily Schedule go into D1,
   stored as JSON. All computers and the Office TV then show the same data.
3. **Hub sign-in, no second login.** Both apps have the same address, so the Daily Schedule
   can read the hub's Supabase sign-in from the browser. The Worker checks the token
   signature. It never writes to Supabase.
4. **Own access list in D1.** Each person is an `editor` (can change) or a `viewer` (can only look).
   The Office TV signs in to the hub with a viewer account.
5. **Replace the hub's `/schedule` page.** Nobody uses it now. It is parked, not deleted.
6. **Hub features that read the old schedule data are for later** (see "Later" below).

## The sequence

- [ ] **1. Build issue #55**: https://github.com/Schrex/daily-schedule/issues/55
      D1 storage, hub sign-in, `/daily-schedule/` route, editor/viewer list, import button.
- [ ] **2. The Scheduler does the import.**
      Open the OLD address (`daily-schedule.schrex.workers.dev`), push the import button,
      then use the new address only.
- [ ] **3. Make the hub change** (see below), in the hub repository.
- [ ] **4. Later:** look at the hub features that use the old schedule data.

## Two warnings

1. **Keep the order.** If the hub change comes before step 1 is live, the Schedule button
   opens an empty page (404).
2. **Import before you change address.** Browser storage is attached to one address.
   The old Daily Schedules are on the Scheduler's computer, under the `workers.dev` address.
   The new address cannot see them. Without the import, the Scheduler gets an empty board
   with the seed Roster.

## Check before building #55

- Is `schreiberexcavating.com` in the same Cloudflare account as the Worker?
  The Worker route needs this.
- Does the hub's Supabase project sign tokens with public keys (JWKS) or with a shared secret?
  This changes how the Worker checks a sign-in.

## The hub change (step 3)

Rules of the hub repository: work on a `feature/*` branch from `develop`. Do not commit to `main`.
Read its `CLAUDE.md` first.

1. Change the `/schedule` route (in `src/App.tsx`) to a small component that does
   `window.location.replace('/daily-schedule/')`.
   - **Do not** only change the links to `/daily-schedule/`. The home tile (`src/pages/Index.tsx`)
     and the bottom menu (`src/components/BottomNav.tsx`) use React Router `navigate()`.
     That stays inside the hub and shows the hub's "Not found" page.
   - A real page load reaches the Worker. `replace` means Back goes to the hub home.
   - This one route change covers all four links to `/schedule`: home tile, bottom menu,
     Job Lookahead, Whiteboard back button.
2. Add a switch in `src/lib/launchScope.ts` (like `integrationsParked`), so that the old page
   can be switched on again.
3. Add the Schedule page to `parked/README.md`: what is parked and how to restore it.
4. Keep the old `Schedule.tsx` code. Keep the `schedule_assignments` table. Delete nothing.
5. Leave `/schedule/whiteboard` as it is for now.

Undo: switch the flag back on. The old page and its data return.

## Later: hub features that use the old schedule data

The hub's old schedule saves placements in the Supabase table `schedule_assignments`.
These hub features read or write it. They are empty now, because nobody uses the old page:

| Hub feature | What it does with `schedule_assignments` |
| --- | --- |
| Jobs list | Counts people on each job today |
| Job page, Lookahead | Shows who is on this job this week |
| Safety, toolbox talk | Finds the foreman's job today and the crew who must sign |
| Whiteboard | Writes to it when a crew tile moves |
| Job status change | Deletes future placements when a job closes |

To feed them later, the options are:

- **A. Sync (recommended).** The Daily Schedule sends Placements to a hub Edge Function,
  which writes `schedule_assignments`. The hub readers stay as they are.
- **B. The hub reads the Daily Schedule API.** Four hub features change, and they depend on the Worker.
- **C. Do not connect.** Those features stay empty.

Options A and B need hub IDs in the Roster (`profiles.id` for a Crew Member, `jobs.id` for a Job).
So the Roster must come from the hub, not be typed by hand.

Features the old hub schedule has and the Daily Schedule does not have yet:

- Crew Members see their own schedule on their phone
- Week view
- Time off
- Start time and role on the job
- Foremen can edit notes

For each one, decide: build it, replace it, or drop it.
