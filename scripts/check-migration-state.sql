-- Check migration status
SELECT 
    migration_name, 
    finished_at, 
    rolled_back_at, 
    applied_steps_count,
    started_at,
    logs
FROM "_prisma_migrations" 
WHERE migration_name = '20251101145823_added_embedings';

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('embeddings', 'resources');

-- Check if pgvector extension exists
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check if index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'embeddings' 
  AND indexname = 'embeddingIndex';

