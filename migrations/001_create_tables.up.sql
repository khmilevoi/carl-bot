CREATE TABLE IF NOT EXISTS messages (
  chat_id INTEGER,
  role TEXT,
  content TEXT,
  username TEXT
);

CREATE TABLE IF NOT EXISTS summaries (
  chat_id INTEGER PRIMARY KEY,
  summary TEXT
);
