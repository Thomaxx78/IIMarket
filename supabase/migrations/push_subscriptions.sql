-- Table pour stocker les subscriptions push Web
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name  text NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index pour retrouver rapidement les subscriptions par user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_name);

-- RLS : tout le monde peut gérer ses propres subscriptions (app sans auth stricte)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
