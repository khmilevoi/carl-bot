BEGIN TRANSACTION;

CREATE TABLE messages_old (
  chat_id INTEGER,
  role TEXT,
  content TEXT,
  username TEXT,
  reply_text TEXT,
  reply_username TEXT,
  full_name TEXT,
  quote_text TEXT
);

INSERT INTO messages_old (
  chat_id,
  role,
  content,
  username,
  reply_text,
  reply_username,
  full_name,
  quote_text
)
SELECT
  m.chat_id,
  m.role,
  m.content,
  u.username,
  m.reply_text,
  m.reply_username,
  CASE
    WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL THEN u.first_name || ' ' || u.last_name
    WHEN u.first_name IS NOT NULL THEN u.first_name
    WHEN u.last_name IS NOT NULL THEN u.last_name
    ELSE NULL
  END AS full_name,
  m.quote_text
FROM messages m
LEFT JOIN users u ON u.id = m.user_id;

DROP TABLE messages;
ALTER TABLE messages_old RENAME TO messages;

COMMIT;
