-- Migration: Rename 'abstract' column to 'thesis_brief' in researches table
-- Date: 2026-01-07

-- Rename the column from 'abstract' to 'thesis_brief'
ALTER TABLE researches 
RENAME COLUMN abstract TO thesis_brief;

-- Add a comment to document the change
COMMENT ON COLUMN researches.thesis_brief IS 'The thesis brief (formerly abstract) of the research';
