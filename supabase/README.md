# Supabase Migrations

This folder contains SQL migrations for the Supabase database.

## Running Migrations

Migrations should be run in the Supabase SQL Editor in order:

1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Run it

## Migration History

| Date | File | Description |
|------|------|-------------|
| 2026-02-02 | `20260202_add_project_fk_on_delete_set_null.sql` | Add FK constraint so deleting a project automatically sets task.project_id to NULL |
