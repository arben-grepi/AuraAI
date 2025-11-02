-- Script to resolve failed migration 20251101145823_added_embedings
-- Run this script on your production database to mark the failed migration as rolled back

-- Step 1: Check current state (run these to see what exists)
-- Uncomment and run these first to understand the state:
/*
SELECT migration_name, finished_at, rolled_back_at, applied_steps_count, logs
FROM "_prisma_migrations" 
WHERE migration_name = '20251101145823_added_embedings';

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('embeddings', 'resources');

SELECT * FROM pg_extension WHERE extname = 'vector';
*/

-- Step 2: Mark the failed migration as rolled back
-- This tells Prisma the migration was rolled back and can be re-applied
UPDATE "_prisma_migrations"
SET finished_at = NULL,
    rolled_back_at = NOW(),
    applied_steps_count = 0,
    logs = NULL
WHERE migration_name = '20251101145823_added_embedings'
  AND finished_at IS NULL; -- Only update if it's still marked as failed

-- Verify the update
SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
FROM "_prisma_migrations" 
WHERE migration_name = '20251101145823_added_embedings';

-- After running this script, go back to your terminal and run:
-- npx prisma migrate deploy

