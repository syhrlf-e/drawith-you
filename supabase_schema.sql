-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strokes table
CREATE TABLE IF NOT EXISTS strokes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  color TEXT NOT NULL,
  size INTEGER NOT NULL,
  points JSONB NOT NULL,
  text TEXT,
  timestamp BIGINT NOT NULL,
  is_complete BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presence table
CREATE TABLE IF NOT EXISTS presence (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  cursor JSONB,
  current_stroke JSONB,
  last_active BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strokes_room_timestamp ON strokes(room_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_presence_room ON presence(room_id);
CREATE INDEX IF NOT EXISTS idx_presence_user ON presence(room_id, user_id);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE strokes;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for now)
-- Rooms
CREATE POLICY "Allow all operations on rooms" ON rooms FOR ALL USING (true);

-- Strokes
CREATE POLICY "Allow all operations on strokes" ON strokes FOR ALL USING (true);

-- Presence
CREATE POLICY "Allow all operations on presence" ON presence FOR ALL USING (true);
