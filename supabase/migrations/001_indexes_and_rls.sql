-- 1. Enable PostGIS Extension
-- This enables advanced geographic queries (like "find nearest terminal")
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add Geography Column & Created_At to Terminals Table
ALTER TABLE terminals 
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid, -- For Google Auth later
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- 3. Populate Geography Column from Latitude/Longitude
-- This safely updates the new location column using the existing lat/lng data
UPDATE terminals 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- 4. Create Performance Indexes
-- Index on category for faster filtering (e.g., showing only Jeeps)
CREATE INDEX IF NOT EXISTS idx_terminals_category ON terminals (category);

-- Spatial index on location for blazing fast proximity queries
CREATE INDEX IF NOT EXISTS idx_terminals_location ON terminals USING GIST (location);

-- GIN index on custom_paths JSONB column for containment queries
CREATE INDEX IF NOT EXISTS idx_terminals_custom_paths ON terminals USING gin (custom_paths jsonb_path_ops);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS Policies
-- Anyone can read terminals (public transit data)
CREATE POLICY "Public read access" ON terminals
  FOR SELECT USING (true);

-- Anyone can insert for now (we will lock this down after Google Auth is fully integrated)
CREATE POLICY "Public insert access" ON terminals
  FOR INSERT WITH CHECK (true);

-- Anyone can update/delete for now (we will lock this down after Google Auth is fully integrated)
CREATE POLICY "Public update access" ON terminals
  FOR UPDATE USING (true);

CREATE POLICY "Public delete access" ON terminals
  FOR DELETE USING (true);
