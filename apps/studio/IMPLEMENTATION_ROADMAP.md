# Roadmap de Implementação - PixlPlayground
**Objetivo:** Alcançar 100% de estabilidade, segurança e funcionamento  
**Abordagem:** Incremental e sem quebrar funcionalidades existentes

---

## FASE 1: ESTABILIZAÇÃO CRÍTICA (2 semanas)
**Objetivo:** Eliminar crashes, memory leaks e perda de dados

### Sprint 1.1: Persistência Robusta (Semana 1)

#### Task 1.1.1: Implementar Versionamento de Projetos
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 2 dias

**Implementação:**
```typescript
// File: src/services/projectVersioning.ts
export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  game_data: any;
  created_at: string;
  created_by: string;
  description?: string;
}

export async function saveProjectVersion(
  projectId: string,
  gameData: any,
  description?: string
): Promise<ProjectVersion> {
  const versions = await getProjectVersions(projectId);
  const nextVersion = versions.length + 1;
  
  const { data, error } = await pixllandClient
    .from('project_versions')
    .insert({
      project_id: projectId,
      version_number: nextVersion,
      game_data: gameData,
      description: description || `Auto-save v${nextVersion}`,
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function restoreProjectVersion(
  projectId: string,
  versionNumber: number
): Promise<void> {
  const { data, error } = await pixllandClient
    .from('project_versions')
    .select('game_data')
    .eq('project_id', projectId)
    .eq('version_number', versionNumber)
    .single();
    
  if (error) throw error;
  
  useEditorStore.setState({
    objects: data.game_data.objects,
    gameScript: data.game_data.gameScript,
    currentTemplateId: data.game_data.currentTemplateId,
  });
}
```

**Migration SQL:**
```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_project_versions.sql
CREATE TABLE public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  game_data JSONB NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

CREATE INDEX idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX idx_project_versions_created_at ON public.project_versions(created_at DESC);

-- RLS
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
```

**Integração:**
```typescript
// File: src/hooks/useProjectAutoSave.ts
// Modificar para criar versão a cada auto-save significativo

const saveToCloud = useCallback(async () => {
  // ... existing code ...
  
  // Criar versão se mudanças significativas
  const shouldVersion = hasSignificantChanges(lastSave, currentState);
  if (shouldVersion && cloudProjectId) {
    await saveProjectVersion(
      cloudProjectId,
      gameData,
      `Auto-save ${new Date().toLocaleString()}`
    );
  }
}, [cloudProjectId]);
```

#### Task 1.1.2: Conflict Resolution
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 1.5 dias

```typescript
// File: src/services/conflictResolution.ts
export interface ConflictInfo {
  local: any;
  remote: any;
  timestamp_local: string;
  timestamp_remote: string;
}

export async function detectConflict(
  projectId: string,
  localData: any,
  localTimestamp: string
): Promise<ConflictInfo | null> {
  const { data: remote } = await pixllandClient
    .from('projects')
    .select('game_data, updated_at')
    .eq('id', projectId)
    .single();
    
  if (!remote) return null;
  
  // Conflict se remote foi atualizado depois do local
  if (new Date(remote.updated_at) > new Date(localTimestamp)) {
    return {
      local: localData,
      remote: remote.game_data,
      timestamp_local: localTimestamp,
      timestamp_remote: remote.updated_at,
    };
  }
  
  return null;
}

export function resolveConflict(
  conflict: ConflictInfo,
  strategy: 'local' | 'remote' | 'merge'
): any {
  switch (strategy) {
    case 'local':
      return conflict.local;
    case 'remote':
      return conflict.remote;
    case 'merge':
      // Merge inteligente (pegar objetos mais recentes de cada)
      return mergeGameData(conflict.local, conflict.remote);
  }
}

function mergeGameData(local: any, remote: any): any {
  // Merge por objeto (usa o mais recente de cada)
  const localObjects = new Map(local.objects.map((o: any) => [o.id, o]));
  const remoteObjects = new Map(remote.objects.map((o: any) => [o.id, o]));
  
  const mergedObjects = [];
  const allIds = new Set([...localObjects.keys(), ...remoteObjects.keys()]);
  
  for (const id of allIds) {
    const localObj = localObjects.get(id);
    const remoteObj = remoteObjects.get(id);
    
    if (!remoteObj) {
      // Objeto só existe no local, manter
      mergedObjects.push(localObj);
    } else if (!localObj) {
      // Objeto só existe no remote, adicionar
      mergedObjects.push(remoteObj);
    } else {
      // Ambos existem, pegar o mais recente (se tiver timestamp)
      // Simplificação: preferir local
      mergedObjects.push(localObj);
    }
  }
  
  return {
    objects: mergedObjects,
    gameScript: local.gameScript || remote.gameScript,
    currentTemplateId: local.currentTemplateId || remote.currentTemplateId,
  };
}
```

**UI Component:**
```tsx
// File: src/components/editor/ConflictResolutionDialog.tsx
export function ConflictResolutionDialog({ 
  conflict, 
  onResolve 
}: { 
  conflict: ConflictInfo;
  onResolve: (strategy: 'local' | 'remote' | 'merge') => void;
}) {
  return (
    <Dialog open={true}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>⚠️ Conflito Detectado</DialogTitle>
          <DialogDescription>
            Seu projeto foi modificado em outro dispositivo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-bold">Versão Local</h3>
            <p className="text-sm text-muted-foreground">
              {conflict.local.objects.length} objetos
            </p>
            <p className="text-xs">
              {new Date(conflict.timestamp_local).toLocaleString()}
            </p>
          </div>
          
          <div>
            <h3 className="font-bold">Versão Remota</h3>
            <p className="text-sm text-muted-foreground">
              {conflict.remote.objects.length} objetos
            </p>
            <p className="text-xs">
              {new Date(conflict.timestamp_remote).toLocaleString()}
            </p>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onResolve('remote')}>
            Usar Versão Remota
          </Button>
          <Button variant="outline" onClick={() => onResolve('local')}>
            Manter Versão Local
          </Button>
          <Button onClick={() => onResolve('merge')}>
            Mesclar Automaticamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Task 1.1.3: LocalStorage Fallback
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 1 dia

```typescript
// File: src/services/storageManager.ts
const MAX_LOCALSTORAGE_SIZE = 4.5 * 1024 * 1024; // 4.5MB (safe limit)

export class StorageManager {
  private static instance: StorageManager;
  private compressionEnabled = true;
  
  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }
  
  async save(key: string, data: any): Promise<void> {
    let serialized = JSON.stringify(data);
    
    // Tentar comprimir se grande
    if (serialized.length > 100000 && this.compressionEnabled) {
      try {
        serialized = await this.compress(serialized);
      } catch (e) {
        console.warn('Compression failed, saving uncompressed');
      }
    }
    
    // Verificar se cabe
    if (serialized.length > MAX_LOCALSTORAGE_SIZE) {
      // Estratégias de fallback
      await this.handleOverflow(key, data);
      return;
    }
    
    try {
      localStorage.setItem(key, serialized);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        await this.handleOverflow(key, data);
      } else {
        throw e;
      }
    }
  }
  
  private async handleOverflow(key: string, data: any): Promise<void> {
    // Estratégia 1: Limpar versões antigas
    this.clearOldVersions();
    
    // Estratégia 2: Salvar só metadata
    const metadata = {
      objects: data.objects.map((o: any) => ({
        id: o.id,
        name: o.name,
        type: o.type,
      })),
      objectCount: data.objects.length,
      truncated: true,
    };
    
    localStorage.setItem(key + '_metadata', JSON.stringify(metadata));
    
    // Estratégia 3: Notificar usuário
    toast.warning(
      'Projeto muito grande para salvar localmente. Salvando apenas na nuvem.',
      { duration: 5000 }
    );
    
    // Forçar save na nuvem
    await this.forcedCloudSave(data);
  }
  
  private async compress(data: string): Promise<string> {
    // Usar CompressionStream API se disponível
    if ('CompressionStream' in window) {
      const blob = new Blob([data]);
      const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
      const compressed = await new Response(stream).blob();
      return await compressed.text();
    }
    return data;
  }
  
  private clearOldVersions(): void {
    // Limpar backups antigos
    const keys = Object.keys(localStorage);
    const backupKeys = keys.filter(k => k.startsWith('project_backup_'));
    
    // Manter só os 3 mais recentes
    backupKeys.sort().slice(0, -3).forEach(k => {
      localStorage.removeItem(k);
    });
  }
  
  private async forcedCloudSave(data: any): Promise<void> {
    // Implementar save forçado na nuvem
    const cloudProjectId = useProjectAutoSave.getState().cloudProjectId;
    if (cloudProjectId) {
      await updateProject(cloudProjectId, { game_data: data });
    }
  }
}
```

### Sprint 1.2: Memory Management (Semana 2)

#### Task 1.2.1: Three.js Resource Cleanup
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 2 dias

```typescript
// File: src/utils/threeCleanup.ts
export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Cleanup geometry
      if (child.geometry) {
        child.geometry.dispose();
      }
      
      // Cleanup materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });
  
  // Remove from parent
  if (object.parent) {
    object.parent.remove(object);
  }
}

function disposeMaterial(material: THREE.Material): void {
  // Dispose textures
  Object.keys(material).forEach((key) => {
    const value = (material as any)[key];
    if (value && typeof value === 'object' && 'minFilter' in value) {
      // É uma texture
      value.dispose();
    }
  });
  
  material.dispose();
}

export function disposeScene(scene: THREE.Scene): void {
  // Dispose all objects in scene
  const objects = scene.children.slice(); // Copy array
  objects.forEach(obj => {
    disposeObject3D(obj);
  });
  
  // Clear arrays
  scene.children.length = 0;
}
```

**Integração:**
```typescript
// File: src/components/canvas/EditorCanvas.tsx
useEffect(() => {
  return () => {
    // Cleanup on unmount
    if (sceneRef.current) {
      disposeScene(sceneRef.current);
    }
  };
}, []);

// File: src/hooks/useGameObjectCleanup.ts
export function useGameObjectCleanup(objects: SceneObject[]) {
  const previousObjects = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const currentIds = new Set(objects.map(o => o.id));
    
    // Find deleted objects
    const deletedIds = Array.from(previousObjects.current)
      .filter(id => !currentIds.has(id));
    
    // Cleanup deleted objects
    deletedIds.forEach(id => {
      const object = scene.getObjectByName(id);
      if (object) {
        disposeObject3D(object);
      }
    });
    
    previousObjects.current = currentIds;
  }, [objects]);
}
```

#### Task 1.2.2: Rapier World Cleanup
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 1 dia

```typescript
// File: src/hooks/useRapierWorldCleanup.ts
import { useRapier } from '@react-three/rapier';
import { useEffect } from 'react';

export function useRapierWorldCleanup() {
  const { world } = useRapier();
  
  useEffect(() => {
    return () => {
      // Cleanup all bodies
      if (world) {
        try {
          // Remove all rigid bodies
          const bodies = world.bodies;
          bodies.forEach((body) => {
            try {
              world.removeRigidBody(body);
            } catch (e) {
              // Body might already be removed
              console.warn('Failed to remove body:', e);
            }
          });
          
          // Remove all colliders
          const colliders = world.colliders;
          colliders.forEach((collider) => {
            try {
              world.removeCollider(collider, true);
            } catch (e) {
              console.warn('Failed to remove collider:', e);
            }
          });
          
          console.log('[Rapier] World cleaned up');
        } catch (e) {
          console.error('[Rapier] Cleanup error:', e);
        }
      }
    };
  }, [world]);
}
```

#### Task 1.2.3: AudioContext Lifecycle
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 0.5 dias

```typescript
// File: src/stores/audioStore.ts
// Adicionar cleanup method

interface AudioStore {
  // ... existing state ...
  cleanup: () => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  // ... existing state ...
  
  cleanup: () => {
    const { audioContext, audioSources } = get();
    
    // Stop all sources
    audioSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    
    // Close audio context
    if (audioContext) {
      audioContext.close();
    }
    
    set({
      audioContext: null,
      audioListener: null,
      audioSources: new Map(),
      isInitialized: false,
    });
    
    console.log('[Audio] Context cleaned up');
  },
}));

// Usar ao sair do editor
// File: src/pages/EditorPage.tsx
useEffect(() => {
  return () => {
    useAudioStore.getState().cleanup();
  };
}, []);
```

#### Task 1.2.4: WebGL Context Loss Recovery
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 1 dia

```typescript
// File: src/components/canvas/WebGLContextRecovery.tsx
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export function WebGLContextRecovery() {
  const { gl, invalidate } = useThree();
  
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('[WebGL] Context lost');
      
      toast.warning('Conexão gráfica perdida. Recuperando...', {
        duration: 3000,
      });
    };
    
    const handleContextRestored = () => {
      console.log('[WebGL] Context restored');
      
      // Forçar re-render de tudo
      invalidate();
      
      toast.success('Conexão gráfica restaurada!', {
        duration: 2000,
      });
      
      // Recarregar texturas e geometrias
      reloadSceneResources();
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, invalidate]);
  
  return null;
}

function reloadSceneResources() {
  // Trigger reload of all textures and geometries
  const { objects } = useEditorStore.getState();
  
  // Force re-render by updating objects
  useEditorStore.setState({
    objects: [...objects],
  });
}
```

---

## FASE 2: SEGURANÇA E VALIDAÇÃO (2 semanas)

### Sprint 2.1: Input Sanitization (Semana 3)

#### Task 2.1.1: Sanitizar User Content
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 1 dia

```typescript
// File: src/utils/sanitization.ts
import DOMPurify from 'dompurify';

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });
}

export function sanitizeObjectName(name: string): string {
  // Remove caracteres perigosos
  return name
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/[<>'"]/g, '')
    .trim()
    .slice(0, 100); // Limit length
}

export function validateGameScript(script: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[];
  
  // Checar por código malicioso
  const dangerousPatterns = [
    /eval\(/i,
    /Function\(/i,
    /XMLHttpRequest/i,
    /fetch\(/i,
    /localStorage/i,
    /sessionStorage/i,
    /document\.cookie/i,
    /__proto__/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(script)) {
      errors.push(`Código potencialmente perigoso detectado: ${pattern.source}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Aplicar em todos os inputs:**
```typescript
// File: src/stores/editorStore.ts
addObject: (type, position) => {
  const newObject = getDefaultObject(type, position);
  
  // Sanitizar nome
  newObject.name = sanitizeObjectName(newObject.name);
  
  set((state) => ({
    objects: [...state.objects, newObject],
    selectedObjectId: newObject.id,
  }));
},

setGameScript: (script) => {
  // Validar antes de salvar
  const { valid, errors } = validateGameScript(script);
  
  if (!valid) {
    toast.error('Script contém código não permitido', {
      description: errors[0],
    });
    return;
  }
  
  set({ gameScript: script });
},
```

#### Task 2.1.2: Server-Side Validation
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 2 dias

```typescript
// File: supabase/functions/validate-project/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateProjectData(gameData: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validar estrutura
  if (!gameData || typeof gameData !== 'object') {
    errors.push('game_data deve ser um objeto');
    return { valid: false, errors, warnings };
  }
  
  // Validar objects array
  if (!Array.isArray(gameData.objects)) {
    errors.push('objects deve ser um array');
  } else {
    // Limites
    if (gameData.objects.length > 1000) {
      errors.push('Máximo de 1000 objetos por projeto');
    }
    
    if (gameData.objects.length > 500) {
      warnings.push('Projeto grande pode ter performance reduzida');
    }
    
    // Validar cada objeto
    gameData.objects.forEach((obj: any, idx: number) => {
      if (!obj.id || !obj.type || !obj.name) {
        errors.push(`Objeto ${idx} inválido: faltam campos obrigatórios`);
      }
      
      // Validar nome
      if (obj.name && obj.name.length > 100) {
        errors.push(`Objeto ${idx}: nome muito longo`);
      }
      
      // Validar posição
      if (obj.position && !Array.isArray(obj.position)) {
        errors.push(`Objeto ${idx}: posição inválida`);
      }
    });
  }
  
  // Validar gameScript
  if (gameData.gameScript) {
    const dangerousPatterns = [
      /eval\(/i,
      /Function\(/i,
      /XMLHttpRequest/i,
      /fetch\(/i,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(gameData.gameScript)) {
        errors.push(`Script contém código não permitido: ${pattern.source}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { gameData } = await req.json();
    
    // Validar
    const result = validateProjectData(gameData);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Integrar no save:**
```typescript
// File: src/hooks/useProjectAutoSave.ts
const saveToCloud = useCallback(async () => {
  // ... existing code ...
  
  // Validar antes de salvar
  const validationResult = await validateProjectData(gameData);
  
  if (!validationResult.valid) {
    toast.error('Projeto contém dados inválidos', {
      description: validationResult.errors[0],
    });
    return;
  }
  
  // Warnings não bloqueiam, só alertam
  if (validationResult.warnings.length > 0) {
    toast.warning(validationResult.warnings[0]);
  }
  
  // Continuar com save...
}, []);
```

### Sprint 2.2: Rate Limiting & CORS (Semana 4)

#### Task 2.2.1: Rate Limiting nas Edge Functions
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 1 dia

```typescript
// File: supabase/functions/_shared/rateLimiter.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'groq-ai': { maxRequests: 20, windowMs: 60000 }, // 20 req/min
  'validate-project': { maxRequests: 10, windowMs: 60000 }, // 10 req/min
  'engine-bridge': { maxRequests: 30, windowMs: 60000 }, // 30 req/min
};

export async function checkRateLimit(
  supabase: any,
  userId: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number }> {
  const config = DEFAULT_LIMITS[endpoint] || { maxRequests: 10, windowMs: 60000 };
  
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Usar tabela rate_limits
  const { data: limits } = await supabase
    .from('rate_limits')
    .select('request_count, window_start')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('window_start', new Date(windowStart).toISOString())
    .maybeSingle();
  
  if (!limits) {
    // Primeira requisição na janela
    await supabase
      .from('rate_limits')
      .insert({
        user_id: userId,
        endpoint,
        request_count: 1,
        window_start: new Date(now).toISOString(),
      });
    
    return { allowed: true, remaining: config.maxRequests - 1 };
  }
  
  if (limits.request_count >= config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  // Incrementar contador
  await supabase
    .from('rate_limits')
    .update({ request_count: limits.request_count + 1 })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  
  return {
    allowed: true,
    remaining: config.maxRequests - limits.request_count - 1,
  };
}
```

**Migration:**
```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_rate_limits.sql
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

-- Cleanup automatico de registros antigos (> 1 hora)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Rodar cleanup a cada hora
SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_old_rate_limits()');
```

**Aplicar em edge functions:**
```typescript
// File: supabase/functions/groq-ai/index.ts
import { checkRateLimit } from '../_shared/rateLimiter.ts';

serve(async (req) => {
  // ... auth code ...
  
  // Rate limiting
  const rateLimit = await checkRateLimit(supabase, user.id, 'groq-ai');
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ 
        error: 'Rate limit exceeded. Try again in 1 minute.',
        retryAfter: 60,
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + 60000),
        } 
      }
    );
  }
  
  // ... rest of function ...
});
```

#### Task 2.2.2: CORS Restritivo
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 0.5 dias

```typescript
// File: supabase/functions/_shared/cors.ts
export function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin') || '';
  
  const allowedOrigins = [
    'https://pixlplaygroundstudio.lovable.app',
    import.meta.env.VITE_PIXLLAND_PLATFORM_ORIGIN || 'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173',
  ];
  
  // Allow Lovable preview URLs
  if (origin.endsWith('.lovable.app') || origin.endsWith('.lovableproject.com')) {
    return origin;
  }
  
  return allowedOrigins.includes(origin) ? origin : '';
}

export function getCorsHeaders(req: Request) {
  const origin = getAllowedOrigin(req);
  
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

---

## FASE 3: PERFORMANCE E UX (2 semanas)

### Sprint 3.1: Performance Optimization (Semana 5)

#### Task 3.1.1: LOD System Real
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 2 dias

```typescript
// File: src/components/canvas/LODSystem.tsx
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface LODLevel {
  distance: number;
  geometry: THREE.BufferGeometry;
}

export function LODObject({
  position,
  levels,
  ...props
}: {
  position: [number, number, number];
  levels: LODLevel[];
}) {
  const lodRef = useRef<THREE.LOD>(null);
  const cameraPos = useRef(new THREE.Vector3());
  const objectPos = useMemo(() => new THREE.Vector3(...position), [position]);
  
  useFrame(({ camera }) => {
    if (!lodRef.current) return;
    
    cameraPos.current.setFromMatrixPosition(camera.matrixWorld);
    const distance = cameraPos.current.distanceTo(objectPos);
    
    // Trocar nível de LOD baseado na distância
    lodRef.current.update(camera);
  });
  
  return (
    <lOD ref={lodRef} position={position} {...props}>
      {levels.map((level, i) => (
        <mesh key={i} geometry={level.geometry}>
          <meshStandardMaterial />
        </mesh>
      ))}
    </lOD>
  );
}

// Helper para gerar níveis de LOD automaticamente
export function generateLODLevels(
  baseGeometry: THREE.BufferGeometry
): LODLevel[] {
  return [
    { distance: 0, geometry: baseGeometry }, // High detail
    { distance: 20, geometry: simplifyGeometry(baseGeometry, 0.5) }, // Medium
    { distance: 50, geometry: simplifyGeometry(baseGeometry, 0.25) }, // Low
    { distance: 100, geometry: createBillboard(baseGeometry) }, // Billboard
  ];
}

function simplifyGeometry(
  geometry: THREE.BufferGeometry,
  ratio: number
): THREE.BufferGeometry {
  // Simplificar geometria (remover vertices)
  // Usar SimplifyModifier ou similar
  // Por enquanto, retornar a mesma
  return geometry.clone();
}

function createBillboard(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  // Criar billboard simples (quad)
  return new THREE.PlaneGeometry(1, 1);
}
```

#### Task 3.1.2: Object Pooling
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 1.5 dias

```typescript
// File: src/utils/objectPool.ts
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;
  
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    
    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }
  
  acquire(): T {
    let obj: T;
    
    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      if (this.inUse.size >= this.maxSize) {
        throw new Error('Object pool exhausted');
      }
      obj = this.factory();
    }
    
    this.inUse.add(obj);
    return obj;
  }
  
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('Releasing object not in use');
      return;
    }
    
    this.inUse.delete(obj);
    this.reset(obj);
    this.available.push(obj);
  }
  
  releaseAll(): void {
    this.inUse.forEach(obj => {
      this.reset(obj);
      this.available.push(obj);
    });
    this.inUse.clear();
  }
  
  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
}

// Pool de projectiles
export const projectilePool = new ObjectPool<THREE.Mesh>(
  () => new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  ),
  (mesh) => {
    mesh.position.set(0, 0, 0);
    mesh.visible = false;
  },
  50, // initial
  200  // max
);

// Pool de particles
export const particlePool = new ObjectPool<THREE.Points>(
  () => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(100 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.05, color: 0xff0000 })
    );
  },
  (points) => {
    points.position.set(0, 0, 0);
    points.visible = false;
  },
  20,
  50
);
```

**Usar nos controllers:**
```typescript
// File: src/components/canvas/controllers/FPSController.tsx
const shootProjectile = () => {
  // Ao invés de criar novo:
  // const mesh = new THREE.Mesh(...)
  
  // Usar pool:
  const projectile = projectilePool.acquire();
  projectile.position.copy(meshRef.current.position);
  projectile.visible = true;
  
  // Adicionar à cena
  scene.add(projectile);
  
  // Depois de 5s, devolver ao pool
  setTimeout(() => {
    scene.remove(projectile);
    projectilePool.release(projectile);
  }, 5000);
};
```

#### Task 3.1.3: Frustum Culling Otimizado
**Prioridade:** 🟢 BAIXA  
**Tempo Estimado:** 1 dia

```typescript
// File: src/components/canvas/FrustumCullingOptimizer.tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function FrustumCullingOptimizer() {
  const { scene, camera } = useThree();
  const frustum = useRef(new THREE.Frustum());
  const projScreenMatrix = useRef(new THREE.Matrix4());
  const lastCheck = useRef(0);
  const CHECK_INTERVAL = 100; // ms
  
  useFrame((_, delta) => {
    const now = Date.now();
    if (now - lastCheck.current < CHECK_INTERVAL) return;
    lastCheck.current = now;
    
    // Update frustum
    projScreenMatrix.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.current.setFromProjectionMatrix(projScreenMatrix.current);
    
    // Check all meshes
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Skip if already culled by Three.js
        if (!object.frustumCulled) return;
        
        // Manual distance culling
        const distance = camera.position.distanceTo(object.position);
        
        if (distance > 200) {
          object.visible = false;
          return;
        }
        
        // Frustum culling
        if (!frustum.current.intersectsObject(object)) {
          object.visible = false;
        } else {
          object.visible = true;
        }
      }
    });
  });
  
  return null;
}
```

### Sprint 3.2: UX Improvements (Semana 6)

#### Task 3.2.1: Undo/Redo Robusto
**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 2 dias

```typescript
// File: src/stores/undoRedoStore.ts
import { create } from 'zustand';
import { useEditorStore } from './editorStore';

interface HistoryEntry {
  objects: any[];
  selectedObjectId: string | null;
  timestamp: number;
}

interface UndoRedoStore {
  history: HistoryEntry[];
  currentIndex: number;
  maxHistory: number;
  
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export const useUndoRedoStore = create<UndoRedoStore>((set, get) => ({
  history: [],
  currentIndex: -1,
  maxHistory: 50,
  
  pushHistory: () => {
    const { objects, selectedObjectId } = useEditorStore.getState();
    const { history, currentIndex, maxHistory } = get();
    
    // Deep clone para evitar mutações
    const entry: HistoryEntry = {
      objects: JSON.parse(JSON.stringify(objects)),
      selectedObjectId,
      timestamp: Date.now(),
    };
    
    // Remove entries after current index (se user fez undo e depois mudou algo)
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(entry);
    
    // Limitar tamanho
    if (newHistory.length > maxHistory) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      currentIndex: newHistory.length - 1,
    });
  },
  
  undo: () => {
    const { history, currentIndex } = get();
    
    if (currentIndex <= 0) return;
    
    const newIndex = currentIndex - 1;
    const entry = history[newIndex];
    
    // Restaurar estado
    useEditorStore.setState({
      objects: JSON.parse(JSON.stringify(entry.objects)),
      selectedObjectId: entry.selectedObjectId,
    });
    
    set({ currentIndex: newIndex });
  },
  
  redo: () => {
    const { history, currentIndex } = get();
    
    if (currentIndex >= history.length - 1) return;
    
    const newIndex = currentIndex + 1;
    const entry = history[newIndex];
    
    // Restaurar estado
    useEditorStore.setState({
      objects: JSON.parse(JSON.stringify(entry.objects)),
      selectedObjectId: entry.selectedObjectId,
    });
    
    set({ currentIndex: newIndex });
  },
  
  canUndo: () => {
    const { currentIndex } = get();
    return currentIndex > 0;
  },
  
  canRedo: () => {
    const { history, currentIndex } = get();
    return currentIndex < history.length - 1;
  },
  
  clearHistory: () => {
    set({ history: [], currentIndex: -1 });
  },
}));

// Hook para atalhos de teclado
export function useUndoRedoHotkeys() {
  const { undo, redo, canUndo, canRedo } = useUndoRedoStore();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo()) redo();
        } else {
          if (canUndo()) undo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
```

**Integrar no editor:**
```typescript
// File: src/stores/editorStore.ts
import { useUndoRedoStore } from './undoRedoStore';

// Adicionar pushHistory após cada modificação
addObject: (type, position) => {
  // ... existing code ...
  
  useUndoRedoStore.getState().pushHistory();
},

updateObject: (id, updates) => {
  // ... existing code ...
  
  useUndoRedoStore.getState().pushHistory();
},

deleteObject: (id) => {
  // ... existing code ...
  
  useUndoRedoStore.getState().pushHistory();
},
```

#### Task 3.2.2: Offline Mode com Sync Queue
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 2 dias

```typescript
// File: src/services/offlineQueue.ts
interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  projectId: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  
  constructor() {
    this.loadQueue();
    this.setupListeners();
  }
  
  private loadQueue() {
    const stored = localStorage.getItem('offline_queue');
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }
  
  private saveQueue() {
    localStorage.setItem('offline_queue', JSON.stringify(this.queue));
  }
  
  private setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      toast.success('Conexão restaurada! Sincronizando...');
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      toast.warning('Sem conexão. Alterações serão sincronizadas quando voltar online.');
    });
  }
  
  enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>) {
    const op: QueuedOperation = {
      ...operation,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      retries: 0,
    };
    
    this.queue.push(op);
    this.saveQueue();
    
    if (this.isOnline) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    if (this.isSyncing || !this.isOnline || this.queue.length === 0) {
      return;
    }
    
    this.isSyncing = true;
    
    while (this.queue.length > 0) {
      const op = this.queue[0];
      
      try {
        await this.executeOperation(op);
        
        // Sucesso, remover da fila
        this.queue.shift();
        this.saveQueue();
        
        toast.success(`Sincronizado: ${op.type} ${op.projectId}`);
      } catch (error) {
        console.error('Failed to sync operation:', error);
        
        op.retries++;
        
        if (op.retries >= 3) {
          // Falhou 3 vezes, remover e notificar
          this.queue.shift();
          this.saveQueue();
          
          toast.error(`Falha ao sincronizar ${op.type}. Operação descartada.`);
        } else {
          // Tentar novamente depois
          break;
        }
      }
    }
    
    this.isSyncing = false;
  }
  
  private async executeOperation(op: QueuedOperation): Promise<void> {
    switch (op.type) {
      case 'create':
        await createProject(op.data);
        break;
      case 'update':
        await updateProject(op.projectId, op.data);
        break;
      case 'delete':
        await deleteProject(op.projectId);
        break;
    }
  }
  
  get pending(): number {
    return this.queue.length;
  }
}

export const offlineQueue = new OfflineQueue();
```

**Usar no auto-save:**
```typescript
// File: src/hooks/useProjectAutoSave.ts
const saveToCloud = useCallback(async () => {
  // ... existing code ...
  
  try {
    await updateProject(cloudProjectId, { game_data: gameData });
  } catch (error) {
    // Se falhar (offline ou erro de rede), adicionar à fila
    if (!navigator.onLine) {
      offlineQueue.enqueue({
        type: 'update',
        projectId: cloudProjectId,
        data: { game_data: gameData },
      });
      
      toast.info('Salvo localmente. Será sincronizado quando voltar online.');
    } else {
      throw error;
    }
  }
}, [cloudProjectId]);
```

---

## FASE 4: TESTES E CI/CD (1 semana)

### Sprint 4.1: Testing Infrastructure (Semana 7)

#### Task 4.1.1: Unit Tests para Stores
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 2 dias

```typescript
// File: src/stores/__tests__/editorStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    // Reset store antes de cada teste
    useEditorStore.setState({
      objects: [],
      selectedObjectId: null,
    });
  });
  
  describe('addObject', () => {
    it('should add object to scene', () => {
      const { addObject } = useEditorStore.getState();
      
      addObject('box', [0, 0, 0]);
      
      const { objects } = useEditorStore.getState();
      expect(objects).toHaveLength(1);
      expect(objects[0].type).toBe('box');
    });
    
    it('should select newly added object', () => {
      const { addObject } = useEditorStore.getState();
      
      addObject('sphere', [1, 2, 3]);
      
      const { selectedObjectId, objects } = useEditorStore.getState();
      expect(selectedObjectId).toBe(objects[0].id);
    });
  });
  
  describe('deleteObject', () => {
    it('should remove object from scene', () => {
      const { addObject, deleteObject } = useEditorStore.getState();
      
      addObject('box', [0, 0, 0]);
      const { objects } = useEditorStore.getState();
      const objectId = objects[0].id;
      
      deleteObject(objectId);
      
      const { objects: updatedObjects } = useEditorStore.getState();
      expect(updatedObjects).toHaveLength(0);
    });
    
    it('should deselect deleted object', () => {
      const { addObject, deleteObject } = useEditorStore.getState();
      
      addObject('box', [0, 0, 0]);
      const { objects, selectedObjectId } = useEditorStore.getState();
      
      deleteObject(selectedObjectId!);
      
      const { selectedObjectId: newSelection } = useEditorStore.getState();
      expect(newSelection).toBeNull();
    });
  });
  
  describe('updateObject', () => {
    it('should update object properties', () => {
      const { addObject, updateObject } = useEditorStore.getState();
      
      addObject('box', [0, 0, 0]);
      const { objects } = useEditorStore.getState();
      const objectId = objects[0].id;
      
      updateObject(objectId, { name: 'My Box', color: '#ff0000' });
      
      const { objects: updatedObjects } = useEditorStore.getState();
      expect(updatedObjects[0].name).toBe('My Box');
      expect(updatedObjects[0].color).toBe('#ff0000');
    });
  });
});
```

#### Task 4.1.2: E2E Tests com Playwright
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 2 dias

```typescript
// File: tests/e2e/editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor');
  });
  
  test('should load editor with blank template', async ({ page }) => {
    // Esperar canvas carregar
    await page.waitForSelector('canvas');
    
    // Verificar objetos padrão
    const hierarchy = page.locator('[data-testid="scene-graph"]');
    await expect(hierarchy).toContainText('Sun Light');
    await expect(hierarchy).toContainText('Main Camera');
    await expect(hierarchy).toContainText('Player');
    await expect(hierarchy).toContainText('Chão');
  });
  
  test('should add object via toolbar', async ({ page }) => {
    // Click no botão de adicionar
    await page.click('[data-testid="add-object-button"]');
    
    // Selecionar tipo
    await page.click('[data-testid="object-type-box"]');
    
    // Verificar que objeto foi adicionado
    const hierarchy = page.locator('[data-testid="scene-graph"]');
    await expect(hierarchy).toContainText('Box');
  });
  
  test('should save project', async ({ page }) => {
    // Fazer login primeiro
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    // ... login flow ...
    
    // Ir para editor
    await page.goto('/editor');
    
    // Adicionar objeto
    await page.click('[data-testid="add-object-button"]');
    await page.click('[data-testid="object-type-sphere"]');
    
    // Salvar
    await page.click('[data-testid="save-button"]');
    
    // Verificar toast de sucesso
    await expect(page.locator('.toast')).toContainText('Projeto salvo');
  });
  
  test('should undo/redo actions', async ({ page }) => {
    // Adicionar objeto
    await page.click('[data-testid="add-object-button"]');
    await page.click('[data-testid="object-type-box"]');
    
    const hierarchy = page.locator('[data-testid="scene-graph"]');
    await expect(hierarchy).toContainText('Box');
    
    // Undo (Ctrl+Z)
    await page.keyboard.press('Control+Z');
    await expect(hierarchy).not.toContainText('Box');
    
    // Redo (Ctrl+Shift+Z)
    await page.keyboard.press('Control+Shift+Z');
    await expect(hierarchy).toContainText('Box');
  });
});
```

#### Task 4.1.3: CI/CD com GitHub Actions
**Prioridade:** 🟡 IMPORTANTE  
**Tempo Estimado:** 1 dia

```yaml
# File: .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Build
        run: npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
  
  deploy-preview:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## MÉTRICAS DE SUCESSO

### Checklist Final de Estabilidade (100%)

#### Fase 1: Persistência ✅
- [ ] Zero perda de dados em 100 saves consecutivos
- [ ] Versionamento funcional (criar, listar, restaurar)
- [ ] Conflict resolution testado em 10 cenários
- [ ] LocalStorage overflow tratado gracefully
- [ ] Offline queue sincroniza 100% ao voltar online

#### Fase 2: Memory Management ✅
- [ ] Zero memory leaks em sessão de 1 hora
- [ ] Three.js resources cleanup verificado
- [ ] Rapier world cleanup sem crashes
- [ ] AudioContext lifecycle sem memory bloat
- [ ] WebGL context loss recovery funcional

#### Fase 3: Segurança ✅
- [ ] XSS mitigado (DOMPurify integrado)
- [ ] Server-side validation em 100% dos endpoints
- [ ] Rate limiting ativo em todas edge functions
- [ ] CORS restritivo em produção
- [ ] Nenhum código malicioso passa na validação

#### Fase 4: Performance ✅
- [ ] 60 FPS constante com 200+ objetos
- [ ] LOD system reduz draw calls em 50%+
- [ ] Object pooling para projectiles/particles
- [ ] Frustum culling otimizado
- [ ] Load time < 3s para projetos grandes

#### Fase 5: UX ✅
- [ ] Undo/Redo 100% confiável
- [ ] Nenhuma operação perde estado
- [ ] Offline mode funcional com sync queue
- [ ] Error messages claras e acionáveis
- [ ] Zero crashes em flow normal de uso

---

## CRONOGRAMA TOTAL

| Fase | Duração | Equipe | Prioridade |
|------|---------|--------|------------|
| **Fase 1: Estabilização Crítica** | 2 semanas | 1-2 devs | 🔴 CRÍTICA |
| **Fase 2: Segurança e Validação** | 2 semanas | 1-2 devs | 🔴 CRÍTICA |
| **Fase 3: Performance e UX** | 2 semanas | 1-2 devs | 🟡 IMPORTANTE |
| **Fase 4: Testes e CI/CD** | 1 semana | 1 dev | 🟡 IMPORTANTE |
| **TOTAL** | **7 semanas** | | |

---

## CONCLUSÃO

Este roadmap é **VIÁVEL** e **INCREMENTAL**. Cada fase entrega valor mensurável sem quebrar funcionalidades existentes.

**Próximos Passos Imediatos:**
1. ✅ Criar migrations SQL para `project_versions` e `rate_limits`
2. ✅ Implementar `projectVersioning.ts` e integrar no auto-save
3. ✅ Adicionar conflict resolution UI
4. ✅ Começar memory cleanup (Three.js, Rapier, Audio)

**Depois de concluir este roadmap, a plataforma terá:**
- ✅ 100% de estabilidade (zero crashes, zero data loss)
- ✅ 100% de segurança (validação server-side, rate limiting, sanitização)
- ✅ 100% de performance (60 FPS, LOD, pooling, culling)
- ✅ 100% de UX (undo/redo, offline mode, error handling)

**A plataforma estará pronta para:**
- Lançamento beta público
- Onboarding de usuários reais
- Coleta de feedback
- Avaliação de demanda de multiplayer

**FIM DO ROADMAP**
