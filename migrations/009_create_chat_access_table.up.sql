CREATE TABLE IF NOT EXISTS chat_access (
  chat_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'banned')),
  requested_at INTEGER,
  approved_at INTEGER
);
