-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user
  ON chat_conversations(user_id, updated_at DESC);

-- Add conversation_id to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages(conversation_id, created_at ASC);

-- Migrate existing messages into a single conversation per user
DO $$
DECLARE
  r RECORD;
  conv_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM chat_messages WHERE conversation_id IS NULL
  LOOP
    INSERT INTO chat_conversations (user_id, title, created_at)
    VALUES (r.user_id, 'Conversación anterior', (
      SELECT MIN(created_at) FROM chat_messages WHERE user_id = r.user_id
    ))
    RETURNING id INTO conv_id;

    UPDATE chat_messages
    SET conversation_id = conv_id
    WHERE user_id = r.user_id AND conversation_id IS NULL;
  END LOOP;
END $$;
