-- The settings every Editor and every device share: exactly one row.
-- slack_channel: the Slack channel ID the picture is sent to; empty means the relay's own channel.
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  slack_channel TEXT NOT NULL DEFAULT '',
  saved_at TEXT NOT NULL,
  saved_by TEXT NOT NULL
);
