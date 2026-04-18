-- Grant premium plan to test accounts for familia feature testing
UPDATE users
SET
  plan = 'premium',
  trial_ends_at = NOW() + INTERVAL '10 years'
WHERE email IN ('rodrigolop82@gmail.com', 'ileanmag@gmail.com');
