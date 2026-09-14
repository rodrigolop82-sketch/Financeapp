-- Usage counters for metered free-plan features
create table usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('ai_message', 'statement_import')),
  period text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, feature, period)
);

alter table usage_counters enable row level security;

-- Users can read their own usage
create policy "Users can read own usage"
  on usage_counters for select
  using (auth.uid() = user_id);

-- Writes only via service role (no insert/update/delete policy for authenticated)

-- Atomic increment function callable from service role
create or replace function increment_usage(
  p_user_id uuid,
  p_feature text,
  p_period text,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  insert into usage_counters (user_id, feature, period, count, updated_at)
  values (p_user_id, p_feature, p_period, 1, now())
  on conflict (user_id, feature, period)
  do update set count = usage_counters.count + 1, updated_at = now()
  returning count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'used', v_count,
    'limit', p_limit
  );
end;
$$;
