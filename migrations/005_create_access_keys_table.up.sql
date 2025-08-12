CREATE TABLE IF NOT EXISTS access_keys (
  chat_id INTEGER PRIMARY KEY,
  access_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
