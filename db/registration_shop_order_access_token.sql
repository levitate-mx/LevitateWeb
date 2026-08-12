ALTER TABLE registration_shop_orders ADD COLUMN access_token TEXT;

UPDATE registration_shop_orders
SET access_token = lower(hex(randomblob(16)))
WHERE access_token IS NULL OR access_token = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_shop_orders_access_token
ON registration_shop_orders(access_token)
WHERE access_token IS NOT NULL;
