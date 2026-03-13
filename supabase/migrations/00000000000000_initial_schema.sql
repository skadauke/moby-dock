-- Initial schema for Moby Dock
-- Run this first in the Supabase SQL Editor to create all required tables.

-- ── Projects table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tasks table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'BACKLOG',
  priority TEXT,
  creator TEXT NOT NULL DEFAULT 'HUMAN',
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  assigned_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Quick Access Items table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_access_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, file_path)
);

-- ── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_quick_access_user_id ON quick_access_items(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_access_position ON quick_access_items(user_id, position);

-- ── Auto-update timestamps ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_quick_access_updated_at ON quick_access_items;
CREATE TRIGGER trigger_quick_access_updated_at
  BEFORE UPDATE ON quick_access_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────
-- Enable RLS but allow all operations via service role key
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_access_items ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- If you want anon/authenticated access, add policies here.

-- Note: This migration is idempotent and can be run multiple times safely.
