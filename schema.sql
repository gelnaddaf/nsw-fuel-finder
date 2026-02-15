-- NSW Fuel Price Finder — D1 Schema
-- Stores historical fuel price snapshots for trend analysis

CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_code TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  price REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(station_code, fuel_type, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_station ON price_snapshots(station_code);
CREATE INDEX IF NOT EXISTS idx_snapshots_fuel_type ON price_snapshots(fuel_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_recorded ON price_snapshots(recorded_at);

CREATE TABLE IF NOT EXISTS stations (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  state TEXT NOT NULL DEFAULT 'NSW',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
