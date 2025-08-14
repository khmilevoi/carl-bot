ALTER TABLE users ADD COLUMN attitude TEXT;

CREATE TABLE IF NOT EXISTS chat_users (
  chat_id INTEGER,
  user_id INTEGER,
  PRIMARY KEY(chat_id, user_id)
);
