BEGIN TRANSACTION;

-- Ensure chats exist for foreign key constraint
INSERT OR IGNORE INTO chats (chat_id)
SELECT DISTINCT chat_id FROM messages;

-- Prepare parsed data with separated first and last names
WITH parsed AS (
  SELECT
    chat_id,
    role,
    content,
    username,
    full_name,
    reply_text,
    reply_username,
    quote_text,
    CASE
      WHEN full_name LIKE '% %' THEN substr(full_name, 1, instr(full_name, ' ') - 1)
      ELSE full_name
    END AS first_name,
    CASE
      WHEN full_name LIKE '% %' THEN substr(full_name, instr(full_name, ' ') + 1)
      ELSE NULL
    END AS last_name
  FROM messages
)
-- Insert users extracted from messages
INSERT INTO users (username, first_name, last_name)
SELECT DISTINCT username, first_name, last_name FROM parsed;

-- Create new messages table
CREATE TABLE messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id INTEGER,
  role TEXT,
  content TEXT,
  user_id INTEGER NOT NULL,
  reply_text TEXT,
  reply_username TEXT,
  quote_text TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

-- Copy data from old table to new one
INSERT INTO messages_new (
  chat_id,
  message_id,
  role,
  content,
  user_id,
  reply_text,
  reply_username,
  quote_text
)
SELECT
  p.chat_id,
  NULL,
  p.role,
  p.content,
  u.id,
  p.reply_text,
  p.reply_username,
  p.quote_text
FROM parsed p
JOIN users u ON (
  (p.username IS NULL AND u.username IS NULL) OR u.username = p.username
) AND (
  (p.first_name IS NULL AND u.first_name IS NULL) OR u.first_name = p.first_name
) AND (
  (p.last_name IS NULL AND u.last_name IS NULL) OR u.last_name = p.last_name
);

DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

COMMIT;
