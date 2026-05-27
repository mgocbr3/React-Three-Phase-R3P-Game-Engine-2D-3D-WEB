import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ConflictResolutionDialog } from '@/components/editor/ConflictResolutionDialog';
import { usePixllandBridge } from '@/hooks/usePixllandBridge';
import { useEditorStore } from '@/stores/editorStore';
import { useEditorCloudBridgeStore } from '@/stores/editorCloudBridgeStore';
import { usePixllandProjectStore } from '@/stores/pixllandProjectStore';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';
import { useProjectAutoSave } from '@/legacy/cloud/hooks/useProjectAutoSave';
import { fetchProject } from '@/legacy/cloud/services/projectService';

interface LegacyCloudEditorIntegrationProps {
  isEmbedded: boolean;
  urlProjectId: string | null;
  sampleProjectSlug: string | null;
  localProjectId: string | null;
  autoCreate: boolean;
  autoCreateTitle?: string;
}

export default function LegacyCloudEditorIntegration({
  isEmbedded,
  urlProjectId,
  sampleProjectSlug,
  localProjectId,
  autoCreate,
  autoCreateTitle,
}: LegacyCloudEditorIntegrationProps) {
  const { user } = useAuthStore();
  const {
    setCloudProjectId,
    pendingConflict,
    isResolvingConflict,
    resolveConflict,
  } = useProjectAutoSave();
  const { openProject, saveToPixlland, requestProjects } = usePixllandBridge();
  const currentProjectId = usePixllandProjectStore((s) => s.currentProjectId);
  const setPixllandCurrentProjectId = usePixllandProjectStore((s) => s.setCurrentProjectId);
  const configureBridge = useEditorCloudBridgeStore((s) => s.configureBridge);
  const resetBridge = useEditorCloudBridgeStore((s) => s.resetBridge);
  const hasRequestedRemoteProjectRef = useRef(false);
  const hasAutoCreatedRef = useRef(false);
  const hasLoadedFromCloudRef = useRef(false);

  useEffect(() => {
    configureBridge({
      isReady: true,
      isEmbedded,
      currentProjectId,
      saveToPixlland,
      requestProjects,
      openProject,
      setCurrentProjectId: (projectId) => {
        setPixllandCurrentProjectId(projectId);
        useEditorCloudBridgeStore.getState().configureBridge({ currentProjectId: projectId });
      },
    });
  }, [
    configureBridge,
    currentProjectId,
    isEmbedded,
    openProject,
    requestProjects,
    saveToPixlland,
    setPixllandCurrentProjectId,
  ]);

  useEffect(() => resetBridge, [resetBridge]);

  useEffect(() => {
    const loadCloudProject = async () => {
      if (hasLoadedFromCloudRef.current) return;
      if (sampleProjectSlug) return;
      if (localProjectId) return;
      if (!user || !urlProjectId || isEmbedded) return;

      hasLoadedFromCloudRef.current = true;

      try {
        const project = await fetchProject(urlProjectId);

        if (project && project.game_data) {
          const gameData = project.game_data as any;

          useEditorStore.setState({
            objects: gameData.objects || [],
            currentTemplateId: gameData.currentTemplateId || null,
            gameScript: gameData.gameScript || '// Game Script\n',
          });

          setCloudProjectId(urlProjectId);
          toast.success('Projeto carregado da nuvem!');
        }
      } catch (error) {
        console.error('[LegacyCloudEditorIntegration] Erro ao carregar projeto:', error);
      }
    };

    loadCloudProject();
  }, [isEmbedded, localProjectId, sampleProjectSlug, setCloudProjectId, urlProjectId, user]);

  useEffect(() => {
    if (!isEmbedded) return;
    if (!urlProjectId) return;
    if (hasRequestedRemoteProjectRef.current) return;
    hasRequestedRemoteProjectRef.current = true;

    setPixllandCurrentProjectId(urlProjectId);
    openProject(urlProjectId);
  }, [isEmbedded, openProject, setPixllandCurrentProjectId, urlProjectId]);

  useEffect(() => {
    if (!isEmbedded) return;
    if (!autoCreate) return;
    if (hasAutoCreatedRef.current) return;
    if (urlProjectId) return;

    hasAutoCreatedRef.current = true;
    const timer = window.setTimeout(async () => {
      try {
        const resp: any = await saveToPixlland({
          projectId: null,
          title: autoCreateTitle || 'Novo Projeto',
        });
        const newId = resp?.projectId || resp?.id || resp?.gameId;

        if (newId) {
          setPixllandCurrentProjectId(newId);
          useEditorCloudBridgeStore.getState().configureBridge({ currentProjectId: newId });

          const url = new URL(window.location.href);
          url.searchParams.set('embedded', 'true');
          url.searchParams.set('projectId', newId);
          url.searchParams.delete('autocreate');
          url.searchParams.delete('title');
          window.history.replaceState({}, '', url.toString());

          requestProjects();
          toast.success('Projeto criado e sincronizado!', { duration: 2000 });
        } else {
          toast.error('Projeto criado, mas sem ID retornado pela plataforma.');
        }
      } catch (error) {
        toast.error('Falha ao criar projeto na plataforma.');
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    autoCreate,
    autoCreateTitle,
    isEmbedded,
    requestProjects,
    saveToPixlland,
    setPixllandCurrentProjectId,
    urlProjectId,
  ]);

  return (
    <ConflictResolutionDialog
      conflict={pendingConflict}
      onResolve={resolveConflict}
      onCancel={() => {
        toast.warning('Conflito não resolvido. Suas mudanças não foram salvas na nuvem.');
      }}
      isResolving={isResolvingConflict}
    />
  );
}
