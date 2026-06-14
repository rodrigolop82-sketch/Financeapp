-- Financial Goals module
create table financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  emoji text default '🎯',
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) default 0 check (current_amount >= 0),
  monthly_contribution numeric(12,2),
  target_date date,
  goal_type text check (goal_type in ('emergency_fund', 'travel', 'vehicle', 'education', 'investment', 'custom')) default 'custom',
  status text check (status in ('active', 'completed', 'paused')) default 'active',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references financial_goals(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);

alter table financial_goals enable row level security;
alter table goal_contributions enable row level security;

create policy "own goals" on financial_goals for all using (auth.uid() = user_id);
create policy "own contributions" on goal_contributions for all using (auth.uid() = user_id);

create index on financial_goals(user_id, status);
create index on goal_contributions(goal_id);

-- Trigger to update current_amount on contribution insert
create or replace function update_goal_current_amount()
returns trigger as $$
begin
  update financial_goals
  set current_amount = current_amount + new.amount,
      completed_at = case
        when current_amount + new.amount >= target_amount and completed_at is null
        then now() else completed_at end,
      status = case
        when current_amount + new.amount >= target_amount then 'completed'
        else status end
  where id = new.goal_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_contribution_insert
  after insert on goal_contributions
  for each row execute function update_goal_current_amount();
