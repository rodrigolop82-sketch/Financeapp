-- Household invite links
CREATE TABLE IF NOT EXISTS household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_household_invites_code ON household_invites(invite_code);
CREATE INDEX idx_household_invites_household ON household_invites(household_id);

-- RLS
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

-- Owner can manage invites for their household
CREATE POLICY "Owner can manage invites" ON household_invites
  FOR ALL USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
  );

-- Anyone authenticated can read an invite by code (to accept it)
CREATE POLICY "Anyone can read invite by code" ON household_invites
  FOR SELECT USING (auth.uid() IS NOT NULL);
