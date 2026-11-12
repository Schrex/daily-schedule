# The database

The Daily Schedule keeps everything in one Cloudflare D1 database.

## Its name

| Database | Used by |
| --- | --- |
| `daily-schedule` | Production: app.schreiberexcavating.com/daily-schedule/ |
| `daily-schedule-preview` | PR previews only, never real data |

**Use these names everywhere:** in commands, in the Cloudflare dashboard (Storage & databases → D1)
and in CI.

**Don't type `DB`.** The code reaches the database as `env.DB` (the binding in `wrangler.jsonc`).
That name is only for the code, which can't use a dash. In commands, `DB` works only inside this
folder; anywhere else, Wrangler offers to create a new, empty database called `DB`. Say no to that.

## Tables

```
 people                         roster  (exactly one row)          schedules  (one row per day)
 ─────────────────────          ───────────────────────────         ────────────────────────────
 email  TEXT  PK                id        INTEGER PK (= 1)          date      TEXT PK (YYYY-MM-DD)
 role   'editor' | 'viewer'     body      JSON ─┐                   body      JSON ─┐
                                saved_at  time  │                   saved_at  time  │
                                saved_by  email │                   saved_by  email │
                                                ▼                                   ▼
            { crewMembers: [{ id, name, color, foreman }],   { date,
              jobs:        [{ id, name, jobNumber? }] }        placements: [{ crewMemberId, destination,
                                                                              order, note?, personTasks? }],
                                                                tasks:    { "<jobId>": [ ... ], ... },
                                                                sends:    [{ sentAt, sent }],
                                                                dayNotes: [ ... ] }
```

- **A placement's `destination`** is either `{ kind: 'job', jobId }` or
  `{ kind: 'standing-row', standingRow: 'shop' | 'trucking' | 'off-work' }`.
- **`people`:** only editors need a row. Anyone else signed in to the hub is a viewer automatically.
- **No foreign keys.** Placements point at crew members and jobs by an id inside the JSON.
- **The schema** is in `migrations/`. To change it, add a migration in a PR; CI applies it before
  deploying.

## Looking at the data

These queries only read, so they're safe. There are two places to run them:

- **The dashboard (easiest):** paste the SQL into **Storage & databases → D1 → `daily-schedule` →
  Console**.
- **A terminal:** wrap the SQL as below. The quoted `'SQL'` stops the shell from touching `$`:

```bash
npx wrangler d1 execute daily-schedule --remote --command "$(cat <<'SQL'
SELECT date, json_array_length(body, '$.placements') AS placed,
       json_array_length(body, '$.sends') AS sends, saved_at, saved_by
FROM schedules ORDER BY date DESC;
SQL
)"
```

Who is where on a day, with job names:

```sql
SELECT c.name AS crew_member,
       CASE json_extract(p.value, '$.destination.kind')
         WHEN 'job' THEN (SELECT json_extract(j.value, '$.name')
                          FROM roster, json_each(roster.body, '$.jobs') j
                          WHERE json_extract(j.value, '$.id') = json_extract(p.value, '$.destination.jobId'))
         ELSE json_extract(p.value, '$.destination.standingRow')
       END AS placed_at
FROM schedules s, json_each(s.body, '$.placements') p
JOIN (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.name') AS name
      FROM roster, json_each(roster.body, '$.crewMembers')) c
  ON c.id = json_extract(p.value, '$.crewMemberId')
WHERE s.date = '2026-11-13'
ORDER BY placed_at, json_extract(p.value, '$.order');
```

The jobs, and the crew members:

```sql
SELECT json_extract(value, '$.name') AS job, json_extract(value, '$.jobNumber') AS job_number
FROM roster, json_each(roster.body, '$.jobs');

SELECT json_extract(value, '$.name') AS name, json_extract(value, '$.foreman') AS foreman
FROM roster, json_each(roster.body, '$.crewMembers') ORDER BY foreman DESC, name;
```

Not placed on a day, and the tasks on a day:

```sql
SELECT json_extract(c.value, '$.name') AS not_placed
FROM roster, json_each(roster.body, '$.crewMembers') c
WHERE json_extract(c.value, '$.id') NOT IN (
  SELECT json_extract(p.value, '$.crewMemberId')
  FROM schedules s, json_each(s.body, '$.placements') p WHERE s.date = '2026-11-13');

SELECT t.key AS job_or_row, task.value AS task
FROM schedules s, json_each(s.body, '$.tasks') t, json_each(t.value) task
WHERE s.date = '2026-11-13';
```

**Only `SELECT` here.** `UPDATE`, `DELETE` and `INSERT` change the live board for everyone at once.
Change crew members, jobs and placements in the app instead. The one exception is the editor list,
in the README.

## What removing does

- **Removing a crew member or a job in Settings** takes them off the Roster. They stop showing on the
  day being edited and later days; anyone on a removed job shows as Not Placed.
- **Saved Daily Schedules are not rewritten.** Old placements keep the removed id, but the name lived
  on the Roster, so queries that join the Roster skip them.
- **Each Send keeps a full copy of what was sent,** names included, so it still reads right.
- **Adding someone back creates a new crew member** with a new id. Their old placements don't link
  to it.

## Undoing a mistake

D1 **Time Travel** can rewind the database to any moment in the last **7 days**:

```bash
npx wrangler d1 time-travel info daily-schedule
```

```bash
npx wrangler d1 time-travel restore daily-schedule --timestamp=2026-11-12T22:00:00Z
```

**A restore rewinds everything,** every editor's changes since that moment, not just the mistake.
Nothing older than 7 days can be restored.

## Size

| What | Size |
| --- | --- |
| A Daily Schedule | about 2 KB, plus about 3 KB per Send |
| A year | about 1.5–3 MB |
| The free plan's limit per database | 500 MB |

## Known limits

- **Last save wins.** If two editors change the same day at the same time, the later save replaces
  the earlier one.
- **No history** beyond the last `saved_at`/`saved_by` on each row, and Time Travel's 7 days.
