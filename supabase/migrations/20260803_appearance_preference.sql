-- Add appearance preference column to notification_preferences
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS appearance TEXT NOT NULL DEFAULT 'dark'
  CHECK (appearance IN ('light', 'dark', 'system'));
