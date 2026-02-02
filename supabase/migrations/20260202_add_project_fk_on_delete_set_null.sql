-- Migration: Add foreign key constraint with ON DELETE SET NULL
-- This makes deleteProject atomic - when a project is deleted,
-- all tasks with that project_id automatically get set to NULL.

-- First, drop the existing foreign key if it exists (without ON DELETE action)
ALTER TABLE tasks 
DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;

-- Add the foreign key with ON DELETE SET NULL
ALTER TABLE tasks
ADD CONSTRAINT tasks_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE SET NULL;

-- Note: This migration is idempotent and can be run multiple times safely.
