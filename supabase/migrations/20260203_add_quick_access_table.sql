-- Migration: Add quick_access_items table for user-configurable quick access files
-- This table stores per-user quick access file preferences

CREATE TABLE IF NOT EXISTS quick_access_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,  -- GitHub user ID from Better Auth
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique file paths per user
  UNIQUE(user_id, file_path)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_quick_access_user_id ON quick_access_items(user_id);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_quick_access_position ON quick_access_items(user_id, position);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_quick_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_quick_access_updated_at ON quick_access_items;
CREATE TRIGGER trigger_quick_access_updated_at
  BEFORE UPDATE ON quick_access_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quick_access_updated_at();

-- Note: Run this migration in Supabase SQL Editor
-- After running, you may want to seed default quick access items for existing users
