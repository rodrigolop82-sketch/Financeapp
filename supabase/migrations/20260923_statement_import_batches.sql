-- Multi-photo imports: one statement_imports row per batch, counted once
-- against the free-plan monthly import limit.

ALTER TABLE statement_imports
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS image_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS usage_state TEXT NOT NULL DEFAULT 'none'
    CHECK (usage_state IN ('none', 'pending', 'counted'));

CREATE UNIQUE INDEX IF NOT EXISTS statement_imports_user_batch_idx
  ON statement_imports (user_id, batch_id)
  WHERE batch_id IS NOT NULL;

-- RLS: the old FOR ALL policy let clients edit or forge batch rows (and so
-- skip the usage count). Clients may read their rows, insert non-batch logs
-- (PDF flow) and update only the summary columns of their own rows. Batch
-- rows are created and counted server-side with the service role.
DROP POLICY IF EXISTS "Users see own imports" ON statement_imports;

CREATE POLICY "statement_imports_select_own"
  ON statement_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "statement_imports_insert_own"
  ON statement_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id AND batch_id IS NULL);

CREATE POLICY "statement_imports_update_own"
  ON statement_imports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE INSERT, UPDATE ON statement_imports FROM anon, authenticated;
GRANT INSERT (user_id, household_id, bank_detected, file_type, transactions_found,
              transactions_imported, duplicates_detected, status)
  ON statement_imports TO authenticated;
GRANT UPDATE (bank_detected, transactions_found, transactions_imported, duplicates_detected, status)
  ON statement_imports TO authenticated;

-- Claims one photo slot in a batch. Row-locked so concurrent photos of the
-- same batch serialize. Returns:
--   { ok: true,  needs_usage: bool }  needs_usage => caller must count 1 import
--   { ok: false, reason: 'pending' | 'full' | 'expired' | 'closed' }
CREATE OR REPLACE FUNCTION claim_import_batch_image(
  p_user_id UUID,
  p_household_id UUID,
  p_batch_id UUID,
  p_max_images INTEGER,
  p_window_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r statement_imports%ROWTYPE;
BEGIN
  INSERT INTO statement_imports (user_id, household_id, batch_id, image_count, file_type, status, usage_state)
  VALUES (p_user_id, p_household_id, p_batch_id, 0, 'image', 'processing', 'none')
  ON CONFLICT (user_id, batch_id) WHERE batch_id IS NOT NULL DO NOTHING;

  SELECT * INTO r FROM statement_imports
  WHERE user_id = p_user_id AND batch_id = p_batch_id
  FOR UPDATE;

  IF r.status <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;
  IF r.created_at < now() - make_interval(mins => p_window_minutes) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF r.usage_state = 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pending');
  END IF;
  IF r.image_count >= p_max_images THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  UPDATE statement_imports
  SET image_count = image_count + 1,
      usage_state = CASE WHEN usage_state = 'none' THEN 'pending' ELSE usage_state END
  WHERE id = r.id;

  RETURN jsonb_build_object('ok', true, 'needs_usage', r.usage_state = 'none');
END;
$$;

-- Resolves a 'pending' usage check: counted => 'counted'; rejected (limit
-- reached) => frees the slot and resets to 'none'.
CREATE OR REPLACE FUNCTION settle_import_batch_usage(
  p_user_id UUID,
  p_batch_id UUID,
  p_counted BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_counted THEN
    UPDATE statement_imports SET usage_state = 'counted'
    WHERE user_id = p_user_id AND batch_id = p_batch_id AND usage_state = 'pending';
  ELSE
    UPDATE statement_imports
    SET usage_state = 'none', image_count = GREATEST(0, image_count - 1)
    WHERE user_id = p_user_id AND batch_id = p_batch_id AND usage_state = 'pending';
  END IF;
END;
$$;

-- Frees a slot after a failed extraction. When no photo of the batch is left,
-- returns rollback_usage = true so the caller refunds the monthly import.
CREATE OR REPLACE FUNCTION release_import_batch_image(
  p_user_id UUID,
  p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r statement_imports%ROWTYPE;
BEGIN
  SELECT * INTO r FROM statement_imports
  WHERE user_id = p_user_id AND batch_id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('rollback_usage', false);
  END IF;

  IF r.image_count <= 1 AND r.usage_state = 'counted' THEN
    UPDATE statement_imports SET image_count = 0, usage_state = 'none' WHERE id = r.id;
    RETURN jsonb_build_object('rollback_usage', true);
  END IF;

  UPDATE statement_imports SET image_count = GREATEST(0, image_count - 1) WHERE id = r.id;
  RETURN jsonb_build_object('rollback_usage', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_import_batch_image(UUID, UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION settle_import_batch_usage(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION release_import_batch_image(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_import_batch_image(UUID, UUID, UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION settle_import_batch_usage(UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION release_import_batch_image(UUID, UUID) TO service_role;
