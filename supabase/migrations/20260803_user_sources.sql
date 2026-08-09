-- User financial sources (bank accounts, credit cards, cash)
CREATE TABLE user_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('tarjeta_credito', 'cuenta_bancaria', 'efectivo')),
  bank_name text NOT NULL,
  nickname text,
  detection_method text NOT NULL DEFAULT 'manual' CHECK (detection_method IN ('auto', 'manual')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sources_user_id ON user_sources(user_id);

ALTER TABLE user_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sources" ON user_sources
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sources" ON user_sources
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sources" ON user_sources
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sources" ON user_sources
  FOR DELETE USING (user_id = auth.uid());

-- Monthly status per source (tracks which sources have their statement loaded for a given month)
CREATE TABLE source_monthly_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_source_id uuid NOT NULL REFERENCES user_sources(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  loaded boolean NOT NULL DEFAULT false,
  loaded_at timestamptz,
  UNIQUE (user_source_id, year_month)
);

CREATE INDEX idx_source_monthly_status_source_month
  ON source_monthly_status(user_source_id, year_month);

ALTER TABLE source_monthly_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own source status" ON source_monthly_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_sources us
      WHERE us.id = source_monthly_status.user_source_id
        AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own source status" ON source_monthly_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_sources us
      WHERE us.id = source_monthly_status.user_source_id
        AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own source status" ON source_monthly_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_sources us
      WHERE us.id = source_monthly_status.user_source_id
        AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own source status" ON source_monthly_status
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_sources us
      WHERE us.id = source_monthly_status.user_source_id
        AND us.user_id = auth.uid()
    )
  );
