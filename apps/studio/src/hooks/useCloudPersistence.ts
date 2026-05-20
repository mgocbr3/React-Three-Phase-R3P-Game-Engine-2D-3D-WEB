import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAutoSaveStore } from '@/stores/autoSaveStore';
import { createProject, updateProject, fetchProject, saveGameData } from '@/services/projectService';
import { getBlankTemplateObjects } from '@/lib/blankTemplate';
import { toast } from 'sonner';

/**
 * Hook de persistência híbrida Local + Nuvem
 * 
 * - Sempre salva localmente (localStorage) como backup
 * - Quando logado, sincroniza com o banco de dados (Supabase)
 * - Mostra avisos claros quando não logado
 */
export const useCloudPersistence = () => {
  const { user } = useAuthStore();
  const { objects, currentTemplateId, gameScript, saveProject } = useEditorStore();
  const { setSaveStatus } = useAutoSaveStore();
  
  const currentCloudProjectId = useRef<string | null>(null);
  const lastCloudSaveTime = useRef<number>(0);
  const CLOUD_SAVE_DEBOUNCE = 5000; // 5 seconds minimum between cloud saves
  
  const isLoggedIn = !!user;

  /**
   * Salva o projeto localmente (sempre funciona)
   */
  const saveLocally = useCallback(() => {
    try {
      saveProject();
      console.log('[CloudPersistence]  Salvo localmente');
      return true;
    } catch (error) {
      console.error('[CloudPersistence]  Erro ao salvar localmente:', error);
      return false;
    }
  }, [saveProject]);

  /**
   * Salva o projeto na nuvem (requer login)
   */
  const saveToCloud = useCallback(async (projectName?: string): Promise<string | null> => {
    if (!user) {
      console.log('[CloudPersistence]  Usuário não logado, salvando apenas localmente');
      return null;
    }

    const now = Date.now();
    if (now - lastCloudSaveTime.current < CLOUD_SAVE_DEBOUNCE) {
      console.log('[CloudPersistence] ⏳ Debounce ativo, pulando save na nuvem');
      return currentCloudProjectId.current;
    }

    try {
      setSaveStatus('saving', ' Sincronizando...');
      
      // GARANTIR que sempre tem objetos essenciais
      let finalObjects = objects;
      if (!finalObjects || finalObjects.length === 0) {
        console.warn('[CloudPersistence]  Projeto vazio detectado! Adicionando objetos padrão...');
        finalObjects = getBlankTemplateObjects();
      }

      const gameData = {
        version: 1,
        savedAt: now,
        currentTemplateId,
        gameScript,
        objects: JSON.parse(JSON.stringify(finalObjects)),
      };

      let projectId = currentCloudProjectId.current;

      if (projectId) {
        // Update existing project
        await saveGameData(projectId, gameData);
        console.log('[CloudPersistence]  Projeto atualizado na nuvem:', projectId);
      } else {
        // Create new project
        const name = projectName || `Projeto ${new Date().toLocaleDateString('pt-BR')}`;
        const newProject = await createProject({
          name,
          template_id: currentTemplateId || undefined,
          game_data: gameData,
        });
        projectId = newProject.id;
        currentCloudProjectId.current = projectId;
        console.log('[CloudPersistence]  Novo projeto criado na nuvem:', projectId);
      }

      lastCloudSaveTime.current = now;
      setSaveStatus('saved', ' Salvo na nuvem');
      
      return projectId;
    } catch (error) {
      console.error('[CloudPersistence]  Erro ao salvar na nuvem:', error);
      setSaveStatus('error', ' Erro na nuvem (salvo local)');
      return null;
    }
  }, [user, objects, currentTemplateId, gameScript, setSaveStatus]);

  /**
   * Salva híbrido: local + nuvem (se logado)
   */
  const saveHybrid = useCallback(async (projectName?: string) => {
    // Sempre salva localmente primeiro
    const localSuccess = saveLocally();
    
    if (!localSuccess) {
      setSaveStatus('error', ' Erro ao salvar');
      return { local: false, cloud: false, projectId: null };
    }

    // Se logado, tenta salvar na nuvem também
    if (isLoggedIn) {
      const projectId = await saveToCloud(projectName);
      return { local: true, cloud: !!projectId, projectId };
    }

    setSaveStatus('saved', ' Salvo localmente');
    return { local: true, cloud: false, projectId: null };
  }, [saveLocally, saveToCloud, isLoggedIn, setSaveStatus]);

  /**
   * Carrega projeto da nuvem pelo ID
   */
  const loadFromCloud = useCallback(async (projectId: string) => {
    try {
      setSaveStatus('saving', ' Carregando...');
      
      const project = await fetchProject(projectId);
      
      if (!project || !project.game_data) {
        throw new Error('Projeto não encontrado ou sem dados');
      }

      const gameData = project.game_data as any;
      
      // Atualiza o editor com os dados do projeto
      useEditorStore.setState({
        objects: gameData.objects || [],
        currentTemplateId: gameData.currentTemplateId || null,
        gameScript: gameData.gameScript || '// Game Script\n',
      });

      currentCloudProjectId.current = projectId;
      setSaveStatus('saved', ' Carregado da nuvem');
      
      console.log('[CloudPersistence]  Projeto carregado da nuvem:', projectId);
      return project;
    } catch (error) {
      console.error('[CloudPersistence]  Erro ao carregar da nuvem:', error);
      setSaveStatus('error', ' Erro ao carregar');
      return null;
    }
  }, [setSaveStatus]);

  /**
   * Define o projeto atual (para updates subsequentes)
   */
  const setCurrentCloudProject = useCallback((projectId: string | null) => {
    currentCloudProjectId.current = projectId;
    console.log('[CloudPersistence] Projeto atual definido:', projectId);
  }, []);

  /**
   * Retorna o ID do projeto atual na nuvem
   */
  const getCurrentCloudProjectId = useCallback(() => {
    return currentCloudProjectId.current;
  }, []);

  return {
    isLoggedIn,
    saveLocally,
    saveToCloud,
    saveHybrid,
    loadFromCloud,
    setCurrentCloudProject,
    getCurrentCloudProjectId,
  };
};
