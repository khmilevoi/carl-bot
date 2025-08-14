CREATE TABLE IF NOT EXISTS chat_users (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id),
  FOREIGN KEY(chat_id) REFERENCES chats(chat_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
