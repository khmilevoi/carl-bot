CREATE TABLE router_states (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
