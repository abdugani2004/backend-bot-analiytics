TRUNCATE TABLE activity_logs, bot_health_logs, payments, messages, users, bots RESTART IDENTITY CASCADE;

INSERT INTO bots (
  id,
  bot_identifier,
  bot_type,
  display_name,
  telegram_bot_id,
  encrypted_token,
  verification_status,
  tracking_status,
  webhook_status,
  connected_at,
  verified_at,
  tracking_enabled_at,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'sample_analytics_bot', 'username', '@sample_analytics_bot', NULL, NULL, 'verified', 'enabled', 'enabled', NOW() - INTERVAL '60 days', NOW() - INTERVAL '59 days', NOW() - INTERVAL '58 days', NOW() - INTERVAL '60 days', NOW()),
  ('00000000-0000-0000-0000-000000000002', 'sample-token-hash', 'token', 'Telegram Bot', NULL, NULL, 'pending', 'disabled', 'pending', NOW() - INTERVAL '45 days', NULL, NULL, NOW() - INTERVAL '45 days', NOW());

INSERT INTO users (id, bot_id, telegram_id, username, first_name, last_name, created_at, last_active_at)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'tg-user-' || gs::text,
  'user' || gs::text,
  'First' || gs::text,
  'Last' || gs::text,
  NOW() - ((30 - (gs % 30)) || ' days')::interval,
  NOW() - ((gs % 3) || ' hours')::interval
FROM generate_series(1, 120) AS gs;

INSERT INTO messages (bot_id, user_id, text, created_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  u.id,
  'Sample message #' || row_number() OVER (),
  NOW() - ((row_number() OVER () % 30) || ' days')::interval
FROM users u
CROSS JOIN generate_series(1, 3)
WHERE u.bot_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO payments (bot_id, user_id, amount, currency, created_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  u.id,
  ((row_number() OVER () % 9) + 1) * 4.99,
  'USD',
  NOW() - ((row_number() OVER () % 20) || ' days')::interval
FROM users u
WHERE u.bot_id = '00000000-0000-0000-0000-000000000001'
  AND right(u.telegram_id, 1) IN ('1', '3', '5', '7', '9');

INSERT INTO bot_health_logs (bot_id, status, uptime, request_count, created_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'online',
  99.7,
  10 + (gs % 5),
  NOW() - ((30 - gs) || ' days')::interval
FROM generate_series(1, 30) AS gs;

INSERT INTO activity_logs (bot_id, event_type, description, event_code, params, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'user_joined', 'User tg-user-119 joined', 'user.joined', '{"user":"tg-user-119"}', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'message', 'Message received from tg-user-118', 'message.received', '{"user":"tg-user-118"}', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'payment', 'Payment of 19.96 USD', 'payment.received', '{"amount":19.96,"currency":"USD","user":"tg-user-118"}', NOW() - INTERVAL '90 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'message', 'Message received from tg-user-110', 'message.received', '{"user":"tg-user-110"}', NOW() - INTERVAL '35 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'message', 'Message received from tg-user-101', 'message.received', '{"user":"tg-user-101"}', NOW() - INTERVAL '12 minutes');
