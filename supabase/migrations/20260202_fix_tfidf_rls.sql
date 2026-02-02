-- REQUIRED: Run this SQL in Supabase Dashboard → SQL Editor
-- Step 1: Add the tfidf_vector column (if not exists)
ALTER TABLE public.researches
ADD COLUMN IF NOT EXISTS tfidf_vector jsonb;
-- Step 2: Create GIN index for fast queries
CREATE INDEX IF NOT EXISTS researches_tfidf_vector_idx ON public.researches USING gin (tfidf_vector);
-- Step 3: Allow ANON key to UPDATE tfidf_vector column
-- Check current RLS policies
SELECT schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'researches';
-- Step 4: Add RLS policy to allow updates to tfidf_vector
-- Option A: Allow all updates (if no RLS policy exists)
DROP POLICY IF EXISTS "Allow public tfidf_vector updates" ON public.researches;
CREATE POLICY "Allow public tfidf_vector updates" ON public.researches FOR
UPDATE TO public USING (true) WITH CHECK (true);
-- Option B: If you only want to allow tfidf_vector column updates
-- First, check if RLS is enabled:
SELECT tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'researches';
-- If RLS is enabled and blocking, you can either:
-- 1. Disable RLS temporarily:
-- ALTER TABLE public.researches DISABLE ROW LEVEL SECURITY;
-- 2. Or create a more specific policy:
DROP POLICY IF EXISTS "Enable tfidf_vector updates for service role" ON public.researches;
CREATE POLICY "Enable tfidf_vector updates for service role" ON public.researches FOR
UPDATE TO anon USING (true);
-- Step 5: Verify the column exists
SELECT column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'researches'
  AND column_name = 'tfidf_vector';
-- Step 6: Grant permissions explicitly
GRANT UPDATE (tfidf_vector) ON public.researches TO anon;
GRANT UPDATE (tfidf_vector) ON public.researches TO authenticated;
-- Step 7: Test with a direct update
-- UPDATE public.researches 
-- SET tfidf_vector = '{"test": 1.0}'::jsonb 
-- WHERE id = 'be3a57b0-94df-40bb-a9d9-765a436c23ac';
-- Step 8: Verify it worked
-- SELECT id, title, tfidf_vector IS NOT NULL as has_vector 
-- FROM public.researches 
-- LIMIT 5;