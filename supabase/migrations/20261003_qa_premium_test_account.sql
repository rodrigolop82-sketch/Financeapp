-- Grant premium plan to the QA test account, for validating
-- Insights/Tendencias and other premium-gated features.
UPDATE users
SET
  plan = 'premium',
  trial_ends_at = NOW() + INTERVAL '10 years'
WHERE email = 'qa@zafiapp.com';
