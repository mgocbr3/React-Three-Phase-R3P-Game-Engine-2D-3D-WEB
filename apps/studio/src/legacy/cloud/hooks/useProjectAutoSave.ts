import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useAutoSaveStore } from '@/stores/autoSaveStore';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';
import { saveGameData, createProject } from '@/legacy/cloud/services/projectService';
import { getBlankTemplateObjects } from '@/lib/blankTemplate';
import { FEATURES } from '@/config/features';
import { ENGINE_LOCAL_ONLY } from '@/config/engineMode';
import { isPixllandConfigured } from '@/legacy/cloud/integrations/pixlland/client';
import { saveProjectVersion, hasSignificantChanges } from '@/legacy/cloud/services/projectVersioning';
import { detectConflict, resolveConflict, notifyPlatformOfResolution, type ConflictInfo, type ConflictResolutionStrategy } from '@/legacy/cloud/services/conflictResolution';

const AUTO_SAVE_INTERVAL = 30000; // 30 segundos
const CLOUD_SAVE_INTERVAL = 60000; // 60 segundos para nuvem (menos frequente)
const LARGE_PROJECT_AUTOSAVE_OBJECT_LIMIT = 5000;

export const useProjectAutoSave = () => {
  const { objects, currentTemplateId, gameScript, saveProject } = useEditorStore();
  const { setSaveStatus, recordVersion } = useAutoSaveStore();
  const { user } = useAuthStore();
  const legacyCloudPersistenceEnabled = !ENGINE_LOCAL_ONLY;
  const cloudEnabled = Boolean(!ENGINE_LOCAL_ONLY && isPixllandConfigured && user);

  const cloudProjectIdRef = useRef<string | null>(null);
  const lastCloudSaveRef = useRef<number>(0);
  const lastVersionedDataRef = useRef<any>(null);
  const lastSaveTimestampRef = useRef<string>(new Date().toISOString());
  
  const [pendingConflict, setPendingConflict] = useState<ConflictInfo | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  // Pega o projectId da URL se existir
  useEffect(() => {
    if (!legacyCloudPersistenceEnabled) return;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project') || params.get('projectId');
    if (projectId) {
      cloudProjectIdRef.current = projectId;
    }
  }, [legacyCloudPersistenceEnabled]);

  // Salvar na nuvem
  const saveToCloud = useCallback(async () => {
    if (!cloudEnabled) return false;

    const now = Date.now();
    if (now - lastCloudSaveRef.current < CLOUD_SAVE_INTERVAL / 2) {
      return false; // Debounce
    }

    try {
      // GARANTIR que sempre tem objetos essenciais
      let finalObjects = objects;
      if (!finalObjects || finalObjects.length === 0) {
        console.warn('[AutoSave]  Projeto vazio detectado! Adicionando objetos padrão...');
        finalObjects = getBlankTemplateObjects();
      }

      const gameData = {
        version: 1,
        savedAt: now,
        currentTemplateId,
        gameScript,
        objects: JSON.parse(JSON.stringify(finalObjects)),
      };

      if (cloudProjectIdRef.current) {
        // Detectar conflitos antes de salvar (se feature habilitada)
        if (FEATURES.ENABLE_CONFLICT_DETECTION) {
          const conflict = await detectConflict(
            cloudProjectIdRef.current,
            gameData,
            lastSaveTimestampRef.current
          );

          if (conflict) {
            console.warn('[AutoSave]  Conflito detectado!', conflict);
            setPendingConflict(conflict);
            return false; // Não salva até resolver conflito
          }
        }

        // Atualiza projeto existente
        await saveGameData(cloudProjectIdRef.current, gameData);
        lastSaveTimestampRef.current = new Date().toISOString();
        console.log('[AutoSave]  Projeto atualizado na nuvem:', cloudProjectIdRef.current);
        
        // Criar versão se mudanças significativas (se feature habilitada)
        if (FEATURES.ENABLE_VERSIONING) {
          const shouldVersion = hasSignificantChanges(lastVersionedDataRef.current, gameData);
          if (shouldVersion) {
            await saveProjectVersion(
              cloudProjectIdRef.current,
              gameData,
              `Auto-save ${new Date().toLocaleString('pt-BR')}`
            );
            lastVersionedDataRef.current = gameData;
            console.log('[AutoSave]  Nova versão salva');
          }
        }
      } else {
        // Cria novo projeto
        const newProject = await createProject({
          name: `Projeto ${new Date().toLocaleDateString('pt-BR')}`,
          template_id: currentTemplateId || undefined,
          game_data: gameData,
        });
        cloudProjectIdRef.current = newProject.id;

        // Atualiza URL com o novo projectId (sem reload)
        const url = new URL(window.location.href);
        url.searchParams.set('project', newProject.id);
        window.history.replaceState({}, '', url.toString());

        console.log('[AutoSave]  Novo projeto criado na nuvem:', newProject.id);
        
        // Primeira versão (se feature habilitada)
        if (FEATURES.ENABLE_VERSIONING) {
          await saveProjectVersion(
            newProject.id,
            gameData,
            'Initial version'
          );
          lastVersionedDataRef.current = gameData;
          console.log('[AutoSave]  Versão inicial salva');
        }
      }

      lastCloudSaveRef.current = now;
      return true;
    } catch (error) {
      console.error('[AutoSave]  Erro ao salvar na nuvem:', error);
      return false;
    }
  }, [cloudEnabled, objects, currentTemplateId, gameScript]);

  // Auto-save local a cada 30 segundos
  useEffect(() => {
    if (!legacyCloudPersistenceEnabled) return;
    if (objects.length === 0) return;

    const interval = setInterval(async () => {
      if (objects.length > LARGE_PROJECT_AUTOSAVE_OBJECT_LIMIT) {
        setSaveStatus('saved', ` Auto-save pausado para cena grande (${objects.length} objetos)`);
        return;
      }

      setSaveStatus('saving', ' Salvando...');

      try {
        // 1. Sempre salva localmente
        saveProject();

        // 2. Registra versão
        recordVersion(
          `Auto-save - ${new Date().toLocaleTimeString('pt-BR')}`,
          {
            objects,
            currentTemplateId,
            gameScript,
            timestamp: Date.now(),
          },
          true
        );

        // 3. Se logado, tenta salvar na nuvem também
        if (cloudEnabled) {
          const cloudSuccess = await saveToCloud();
          if (cloudSuccess) {
            setSaveStatus('saved', ` Salvo às ${new Date().toLocaleTimeString('pt-BR')}`);
          } else {
            setSaveStatus('saved', ` Salvo localmente às ${new Date().toLocaleTimeString('pt-BR')}`);
          }
        } else {
          setSaveStatus('saved', ` Salvo localmente às ${new Date().toLocaleTimeString('pt-BR')}`);
        }

        console.log('[AutoSave]  Auto-save realizado');
      } catch (error) {
        setSaveStatus('error', ' Erro ao salvar');
        console.error('[AutoSave] Error:', error);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [objects, currentTemplateId, gameScript, cloudEnabled, saveProject, saveToCloud, setSaveStatus, recordVersion, legacyCloudPersistenceEnabled]);

  // Manual save com Ctrl+S / Cmd+S
  useEffect(() => {
    if (!legacyCloudPersistenceEnabled) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();

        setSaveStatus('saving', ' Salvando...');

        try {
          // Salva localmente
          saveProject();

          // Registra versão
          recordVersion(
            `Manual save - ${new Date().toLocaleTimeString('pt-BR')}`,
            {
              objects,
              currentTemplateId,
              gameScript,
              timestamp: Date.now(),
            },
            false
          );

          // Se logado, salva na nuvem
          if (cloudEnabled) {
            const cloudSuccess = await saveToCloud();
            if (cloudSuccess) {
              setSaveStatus('saved', ` Salvo às ${new Date().toLocaleTimeString('pt-BR')}`);
            } else {
              setSaveStatus('saved', ` Salvo localmente`);
            }
          } else {
            setSaveStatus('saved', ` Salvo localmente`);
          }

          console.log('[AutoSave]  Projeto salvo manualmente');
        } catch (error) {
          setSaveStatus('error', ' Erro ao salvar');
          console.error('[AutoSave] Manual save error:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [objects, currentTemplateId, gameScript, cloudEnabled, saveProject, saveToCloud, setSaveStatus, recordVersion, legacyCloudPersistenceEnabled]);

  // Resolver conflito
  const handleConflictResolution = useCallback(async (strategy: ConflictResolutionStrategy) => {
    if (!legacyCloudPersistenceEnabled) return;
    if (!pendingConflict || !cloudProjectIdRef.current) return;

    setIsResolvingConflict(true);
    
    try {
      // Resolver conflito
      const resolvedData = resolveConflict(pendingConflict, strategy);

      // Aplicar dados resolvidos ao editor
      useEditorStore.setState({
        objects: resolvedData.objects || [],
        gameScript: resolvedData.gameScript || '',
        currentTemplateId: resolvedData.currentTemplateId || null,
      });

      // Salvar dados resolvidos
      await saveGameData(cloudProjectIdRef.current, resolvedData);
      lastSaveTimestampRef.current = new Date().toISOString();

      // Criar versão (apenas se feature habilitada)
      if (FEATURES.ENABLE_VERSIONING) {
        await saveProjectVersion(
          cloudProjectIdRef.current,
          resolvedData,
          `Conflict resolved: ${strategy}`
        );
      }

      // Notificar plataforma Pixland (apenas se conflito habilitado)
      if (FEATURES.ENABLE_CONFLICT_DETECTION) {
        await notifyPlatformOfResolution(
          cloudProjectIdRef.current,
          strategy,
          resolvedData
        );
      }

      setSaveStatus('saved', ` Conflito resolvido (${strategy})`);
      setPendingConflict(null);

      console.log('[AutoSave]  Conflito resolvido com estratégia:', strategy);
    } catch (error) {
      console.error('[AutoSave] Erro ao resolver conflito:', error);
      setSaveStatus('error', ' Erro ao resolver conflito');
    } finally {
      setIsResolvingConflict(false);
    }
  }, [pendingConflict, setSaveStatus, legacyCloudPersistenceEnabled]);

  // Retorna função para definir o projectId externamente + estados de conflito
  return {
    setCloudProjectId: (id: string | null) => {
      if (!legacyCloudPersistenceEnabled) return;
      cloudProjectIdRef.current = id;
    },
    getCloudProjectId: () => cloudProjectIdRef.current,
    pendingConflict,
    isResolvingConflict,
    resolveConflict: handleConflictResolution,
  };
};
