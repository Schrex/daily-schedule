-- The Roster: one row holding the Roster as JSON, with when and by whom it was last saved.
CREATE TABLE roster (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  body TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  saved_by TEXT NOT NULL
);

-- One row per Daily Schedule, keyed by its date (YYYY-MM-DD), holding it as JSON.
CREATE TABLE schedules (
  date TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  saved_by TEXT NOT NULL
);

-- Who may use the Daily Schedule: editors use the board and Settings, viewers the Office TV.
CREATE TABLE people (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer'))
);
