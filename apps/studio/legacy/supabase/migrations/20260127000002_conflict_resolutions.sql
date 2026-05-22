-- Conflict Resolution Audit Tables
-- Tracks conflict resolutions between PixlPlayground Engine and Pixland Harmony Helper
-- Part of Phase 1: Critical Stabilization (Implementation Roadmap)

-- Table to log all conflict resolutions
CREATE TABLE IF NOT EXISTS public.conflict_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  resolution_strategy TEXT NOT NULL CHECK (resolution_strategy IN ('local', 'remote', 'merge')),
  resolved_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_data_snapshot JSONB,
  object_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_project_id ON public.conflict_resolutions(project_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_user_id ON public.conflict_resolutions(user_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_resolved_at ON public.conflict_resolutions(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_strategy ON public.conflict_resolutions(resolution_strategy);

-- Row Level Security (RLS)
ALTER TABLE public.conflict_resolutions ENABLE ROW LEVEL SECURITY;

-- Users can view their own conflict resolutions
CREATE POLICY "Users can view their conflict resolutions"
ON public.conflict_resolutions FOR SELECT
USING (user_id = auth.uid());

-- Users can create conflict resolution logs
CREATE POLICY "Users can create conflict resolutions"
ON public.conflict_resolutions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add column to projects table to track last conflict resolution
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_conflict_resolved_at TIMESTAMP WITH TIME ZONE;

-- Activity logs table (if doesn't exist)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target ON public.activity_logs(target_type, target_id);

-- RLS for activity logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
ON public.activity_logs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own activities"
ON public.activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Function to get conflict statistics for a project
CREATE OR REPLACE FUNCTION get_project_conflict_stats(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_conflicts', COUNT(*),
    'strategy_breakdown', json_object_agg(resolution_strategy, strategy_count),
    'last_conflict', MAX(resolved_at),
    'avg_objects', AVG(object_count)
  ) INTO result
  FROM (
    SELECT 
      resolution_strategy,
      COUNT(*) as strategy_count,
      resolved_at,
      object_count
    FROM public.conflict_resolutions
    WHERE project_id = p_project_id
    GROUP BY resolution_strategy, resolved_at, object_count
  ) sub;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old conflict resolution logs (keep only last 100 per project)
CREATE OR REPLACE FUNCTION cleanup_old_conflict_resolutions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.conflict_resolutions
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY resolved_at DESC) as rn
      FROM public.conflict_resolutions
    ) sub
    WHERE rn > 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run weekly (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-conflict-resolutions', '0 0 * * 0', 'SELECT cleanup_old_conflict_resolutions()');

-- Comments for documentation
COMMENT ON TABLE public.conflict_resolutions IS 'Audit log of all project conflict resolutions between devices';
COMMENT ON COLUMN public.conflict_resolutions.resolution_strategy IS 'Strategy used: local (keep local), remote (keep remote), merge (intelligent merge)';
COMMENT ON COLUMN public.conflict_resolutions.resolved_data_snapshot IS 'Snapshot of resolved data for recovery purposes';
COMMENT ON FUNCTION get_project_conflict_stats IS 'Returns conflict statistics for a specific project';
COMMENT ON FUNCTION cleanup_old_conflict_resolutions IS 'Cleanup function to keep only last 100 resolutions per project';
