# 🚨 APLICAR MIGRATIONS NO SUPABASE

**URGENTE**: As tabelas `project_versions` e `conflict_resolutions` não existem no banco de dados!

## 📋 Passo a Passo

### 1. Acessar Supabase Dashboard
- Ir para o projeto Supabase configurado em `VITE_PIXLLAND_PROJECT_ID`
- Login com a conta autorizada do projeto

### 2. Abrir SQL Editor
- No menu lateral esquerdo, clicar em **"SQL Editor"**
- Clicar em **"New Query"**

### 3. Aplicar Migration 1: Project Versions
**Copiar e executar o conteúdo do arquivo:**
```
supabase/migrations/20260127000001_project_versions.sql
```

**OU copiar este SQL:**
```sql
-- Project Versions Table
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

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON public.project_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_versions_version_number ON public.project_versions(project_id, version_number DESC);

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project versions"
ON public.project_versions FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create versions for their projects"
ON public.project_versions FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their project versions"
ON public.project_versions FOR DELETE
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION cleanup_old_project_versions()
RETURNS void AS $$
BEGIN
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
```

### 4. Aplicar Migration 2: Conflict Resolutions
**Copiar e executar o conteúdo do arquivo:**
```
supabase/migrations/20260127000002_conflict_resolutions.sql
```

**OU copiar este SQL:**
```sql
-- Conflict Resolution Audit Tables
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

CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_project_id ON public.conflict_resolutions(project_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_user_id ON public.conflict_resolutions(user_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_resolved_at ON public.conflict_resolutions(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_strategy ON public.conflict_resolutions(resolution_strategy);

ALTER TABLE public.conflict_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conflict resolutions"
ON public.conflict_resolutions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create conflict resolutions"
ON public.conflict_resolutions FOR INSERT
WITH CHECK (user_id = auth.uid());

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_conflict_resolved_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target ON public.activity_logs(target_type, target_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
ON public.activity_logs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own activities"
ON public.activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

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
```

### 5. Verificar Sucesso
Após executar cada migration, verificar:
- ✅ Mensagem: "Success. No rows returned"
- ✅ Tabelas criadas em **Database > Tables**:
  - `project_versions`
  - `conflict_resolutions`
  - `activity_logs`

### 6. Recarregar Schema Cache
No Supabase Dashboard:
- Ir para **Project Settings** > **API**
- Clicar em **"Reload schema cache"** (ou aguardar 1-2 minutos)

### 7. Testar no PixlPlayground
Recarregar a página do editor (Ctrl+F5) e verificar que os erros desaparecem no console.

---

## 🔍 Troubleshooting

### Se aparecer erro "relation already exists"
Não tem problema! Significa que a tabela já foi criada. Continue com a próxima migration.

### Se aparecer erro de permissão
Verificar se está logado com a conta correta (mgocbr3@gmail.com) que tem acesso ao projeto.

### Se o schema cache não atualizar
- Aguardar 5 minutos
- Fazer logout/login no Supabase Dashboard
- Recarregar a página do PixlPlayground com Ctrl+Shift+R (hard refresh)

---

## ✅ Após aplicar as migrations

Commitar a correção do conflictResolution.ts:
```bash
git add -A
git commit -m "fix: Corrigir detectConflict para usar maybeSingle() e aplicar migrations"
git push
```
