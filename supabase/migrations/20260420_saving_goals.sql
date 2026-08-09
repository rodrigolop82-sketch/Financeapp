-- Savings goals
CREATE TABLE IF NOT EXISTS saving_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎯',
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saving_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can manage saving goals" ON saving_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_id = saving_goals.household_id
        AND user_id = auth.uid()
    )
  );

-- Goal items (budget breakdown)
CREATE TABLE IF NOT EXISTS saving_goal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES saving_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saving_goal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can manage goal items" ON saving_goal_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM saving_goals sg
      JOIN household_members hm ON hm.household_id = sg.household_id
      WHERE sg.id = saving_goal_items.goal_id
        AND hm.user_id = auth.uid()
    )
  );

-- Contribution log
CREATE TABLE IF NOT EXISTS saving_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES saving_goals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saving_goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can manage goal contributions" ON saving_goal_contributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM saving_goals sg
      JOIN household_members hm ON hm.household_id = sg.household_id
      WHERE sg.id = saving_goal_contributions.goal_id
        AND hm.user_id = auth.uid()
    )
  );
