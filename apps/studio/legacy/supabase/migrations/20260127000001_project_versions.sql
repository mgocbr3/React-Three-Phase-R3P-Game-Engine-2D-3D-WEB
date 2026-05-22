-- Project Versions Table
-- Stores historical versions of projects for version control
-- Part of Phase 1: Critical Stabilization (Implementation Roadmap)

CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  game_data JSONB NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_version UNIQUE(project_id, version_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON public.project_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_versions_version_number ON public.project_versions(project_id, version_number DESC);

-- Row Level Security (RLS)
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of their own projects
CREATE POLICY "Users can view their project versions"
ON public.project_versions FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

-- Users can create versions for their own projects
CREATE POLICY "Users can create versions for their projects"
ON public.project_versions FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

-- Users can delete versions of their own projects
CREATE POLICY "Users can delete their project versions"
ON public.project_versions FOR DELETE
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

-- Function to automatically cleanup old versions
-- Keeps only the most recent 50 versions per project
CREATE OR REPLACE FUNCTION cleanup_old_project_versions()
RETURNS void AS $$
BEGIN
  -- Delete versions older than the 50th most recent for each project
  DELETE FROM public.project_versions
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY version_number DESC) as rn
      FROM public.project_versions
    ) sub
    WHERE rn > 50
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run daily at 3 AM
-- Note: Requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-project-versions', '0 3 * * *', 'SELECT cleanup_old_project_versions()');

-- Comment for version tracking
COMMENT ON TABLE public.project_versions IS 'Stores version history of projects for version control and rollback functionality';
COMMENT ON COLUMN public.project_versions.version_number IS 'Sequential version number, increments with each save';
COMMENT ON COLUMN public.project_versions.game_data IS 'Snapshot of project data at this version';
