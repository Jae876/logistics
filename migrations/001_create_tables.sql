-- Migrations for Neon/Postgres: shipments, geofences

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  origin TEXT,
  destination TEXT,
  eta TEXT,
  service TEXT,
  weight TEXT,
  rate TEXT,
  progress INTEGER DEFAULT 0,
  coords JSONB,
  route JSONB,
  sender_name TEXT,
  sender_email TEXT,
  sender_phone TEXT,
  sender_address TEXT,
  receiver_name TEXT,
  receiver_email TEXT,
  receiver_phone TEXT,
  receiver_address TEXT,
  package_description TEXT,
  carrier_name TEXT,
  carrier_reference TEXT,
  quantity TEXT,
  payment_mode TEXT,
  shipment_mode TEXT,
  dispatch_date DATE,
  delivery_date DATE,
  delivery_time TEXT,
  tracking_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geofences (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  center JSONB,
  radius INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- index for quick lookup by created_at
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at DESC);

-- Admin users table for admin login and password management
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
