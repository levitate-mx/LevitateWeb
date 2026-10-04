-- Ordered admin payment pages; applied once by the deployment schema preflight.
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_recent ON registration_inscription_orders(updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_status_recent ON registration_inscription_orders(status, updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_venue_recent ON registration_inscription_orders(venue, updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_recent ON registration_shop_orders(updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_status_recent ON registration_shop_orders(status, updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_venue_recent ON registration_shop_orders(venue, updated_at DESC, created_at DESC, id DESC);
