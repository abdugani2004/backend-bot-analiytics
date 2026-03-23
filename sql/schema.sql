CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  billing_provider_customer_id TEXT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS billing_provider_customer_id TEXT NULL;

CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id UUID NULL REFERENCES accounts(id) ON DELETE CASCADE,
  bot_identifier TEXT NOT NULL,
  bot_type TEXT NOT NULL CHECK (bot_type IN ('token', 'username')),
  display_name TEXT NULL,
  telegram_bot_id TEXT NULL,
  encrypted_token TEXT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  tracking_status TEXT NOT NULL DEFAULT 'disabled' CHECK (tracking_status IN ('disabled', 'enabled')),
  webhook_status TEXT NOT NULL DEFAULT 'pending' CHECK (webhook_status IN ('pending', 'enabled', 'failed')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ NULL,
  tracking_enabled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_type, bot_identifier)
);

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS owner_account_id UUID NULL REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS telegram_bot_id TEXT NULL;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS encrypted_token TEXT NULL;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS tracking_status TEXT NOT NULL DEFAULT 'disabled';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS webhook_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS tracking_enabled_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL,
  username TEXT NULL,
  first_name TEXT NULL,
  last_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline')),
  uptime NUMERIC(5, 2) NOT NULL CHECK (uptime >= 0 AND uptime <= 100),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('manual', 'stripe', 'click')),
  provider_customer_id TEXT NULL,
  provider_subscription_id TEXT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth')),
  status TEXT NOT NULL CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  amount_monthly NUMERIC(12, 2) NOT NULL CHECK (amount_monthly >= 0),
  currency TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NULL REFERENCES accounts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('manual', 'stripe', 'click')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  event_code TEXT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS event_code TEXT NULL;

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS params JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_bot_id_created_at ON users (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_bot_id_last_active_at ON users (bot_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_bot_id_created_at ON messages (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_bot_id_created_at ON payments (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_health_logs_bot_id_created_at ON bot_health_logs (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_bot_id_created_at ON activity_logs (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bots_owner_account_id ON bots (owner_account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_id ON subscriptions (account_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_account_id ON billing_events (account_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bots_updated_at ON bots;
CREATE TRIGGER trg_bots_updated_at
BEFORE UPDATE ON bots
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
