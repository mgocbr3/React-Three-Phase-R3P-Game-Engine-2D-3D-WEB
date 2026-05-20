/**
 * Conflict Resolution Notification Handler
 * 
 * Receives notifications from PixlPlayground Engine when conflicts are resolved
 * Logs the resolution for audit and analytics
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 * 
 * Integration: Communicates with PixlPlayground engine via Supabase Edge Function
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConflictResolutionPayload {
  projectId: string;
  strategy: 'local' | 'remote' | 'merge';
  resolvedData: any;
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[conflict-resolved] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload: ConflictResolutionPayload = await req.json();
    const { projectId, strategy, resolvedData, timestamp } = payload;

    // Validate payload
    if (!projectId || !strategy || !resolvedData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: projectId, strategy, resolvedData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[conflict-resolved] User ${user.id} resolved conflict for project ${projectId} using strategy: ${strategy}`
    );

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, title')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[conflict-resolved] Project not found:', projectError);
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (project.user_id !== user.id) {
      console.error('[conflict-resolved] User does not own project');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log conflict resolution to audit table
    const { error: auditError } = await supabase.from('conflict_resolutions').insert({
      project_id: projectId,
      user_id: user.id,
      resolution_strategy: strategy,
      resolved_at: timestamp,
      resolved_data_snapshot: resolvedData,
      object_count: resolvedData.objects?.length || 0,
    });

    if (auditError) {
      console.error('[conflict-resolved] Failed to log audit:', auditError);
      // Non-fatal - continue even if audit fails
    }

    // Update project's last conflict resolution timestamp
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        last_conflict_resolved_at: timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('[conflict-resolved] Failed to update project timestamp:', updateError);
      // Non-fatal
    }

    // Create activity log
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'conflict_resolved',
      target_type: 'project',
      target_id: projectId,
      metadata: {
        strategy,
        objectCount: resolvedData.objects?.length || 0,
        hasGameScript: !!resolvedData.gameScript,
      },
    });

    // Send success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Conflict resolved successfully using ${strategy} strategy`,
        projectId,
        projectTitle: project.title,
        strategy,
        timestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[conflict-resolved] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
