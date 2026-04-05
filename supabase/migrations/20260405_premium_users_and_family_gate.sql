-- Set rodrigolop82@gmail.com and ileanmag@gmail.com as Premium users
-- These are the founding accounts with full premium access

UPDATE users
SET plan = 'premium'
WHERE email IN ('rodrigolop82@gmail.com', 'ileanmag@gmail.com');
