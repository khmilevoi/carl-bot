CREATE TABLE IF NOT EXISTS access_keys (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  access_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
