import { useEffect, useState } from 'react';
import { EditorCanvas } from '@/components/canvas/EditorCanvas';
import { MobileHeader } from './MobileHeader';
import { MobileToolbar } from './MobileToolbar';
import { MobileBottomNav, MobileTab } from './MobileBottomNav';
import { MobileScenePanel } from './MobileScenePanel';
import { MobileInspectorPanel } from './MobileInspectorPanel';
import { MobileFloatingActions } from './MobileFloatingActions';
import { MobileScriptsPanel } from './MobileScriptsPanel';
import { MobileVibeCodePanel } from './MobileVibeCodePanel';
import { MobileSettingsSheet } from './MobileSettingsSheet';
import { MobileGameControls } from '@/components/canvas/MobileGameControls';
import { MotionControlOverlay } from '@/components/canvas/MotionControlOverlay';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { TerrainSettingsModal } from '@/components/terrain/TerrainSettingsModal';
import { useTerrainStore, defaultTerrainSettings, TerrainSettings } from '@/stores/terrainStore';
import { startRuntimePreviewFromEditor, stopRuntimePreview } from '@/engine/runtime/runtimePreviewControls';
import { toast } from 'sonner';

export const MobileEditorLayout = () => {
  const [activeTab, setActiveTab] = useState<MobileTab>('editor');
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [showVibeCode, setShowVibeCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modalSettings, setModalSettings] = useState<TerrainSettings>(defaultTerrainSettings);
  const isEditMode = useEditorStore((s) => s.isEditMode);
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const { isModalOpen, setModalOpen, createTerrain, updateTerrainSettings } = useTerrainStore();

  const handleTabChange = (tab: MobileTab) => {
    if (tab === 'play') {
      try {
        if (isEditMode) startRuntimePreviewFromEditor();
        setActiveTab('play');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel iniciar o runtime.';
        toast.error(message);
      }
    } else if (tab === 'editor') {
      if (!isEditMode || previewSession) stopRuntimePreview();
      setActiveTab('editor');
    } else {
      setActiveTab(tab);
    }
  };

  const handleTerrainGenerate = (settings: TerrainSettings) => {
    createTerrain(settings);
    setModalOpen(false);
  };

  useEffect(() => {
    if (!previewSession && isEditMode && activeTab === 'play') {
      setActiveTab('editor');
    }
  }, [activeTab, isEditMode, previewSession]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col touch-none overflow-hidden">
      <MobileHeader />

      <div className="flex-1 relative overflow-hidden">
        <EditorCanvas />
        <MobileToolbar onOpenSettings={() => setShowSettings(true)} onOpenHierarchy={() => setShowHierarchy(true)} />
        <MobileFloatingActions />
        <MobileBottomNav 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onInspector={() => setShowInspector(true)}
          onScripts={() => setShowScripts(true)}
          onVibeCode={() => setShowVibeCode(true)}
        />
        
        {/* Touch controls for gameplay - only visible in Play mode */}
        {!isEditMode && (
          <MobileGameControls 
            showJump={true}
            showActions={false}
          />
        )}
      </div>

      <Sheet open={showHierarchy} onOpenChange={setShowHierarchy}>
        <SheetContent side="left" className="w-[80vw] max-w-[320px] p-0 bg-card border-r border-border">
          <MobileScenePanel onClose={() => setShowHierarchy(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={showInspector} onOpenChange={(open) => { setShowInspector(open); if (!open) setActiveTab('editor'); }}>
        <SheetContent side="right" className="w-[85vw] max-w-[360px] p-0 bg-card border-l border-border">
          <MobileInspectorPanel onClose={() => { setShowInspector(false); setActiveTab('editor'); }} />
        </SheetContent>
      </Sheet>

      <Sheet open={showScripts} onOpenChange={(open) => { setShowScripts(open); if (!open) setActiveTab('editor'); }}>
        <SheetContent side="bottom" className="h-[70vh] p-0 bg-card border-t border-border rounded-t-2xl">
          <MobileScriptsPanel onClose={() => { setShowScripts(false); setActiveTab('editor'); }} />
        </SheetContent>
      </Sheet>

      <Sheet open={showVibeCode} onOpenChange={(open) => { setShowVibeCode(open); if (!open) setActiveTab('editor'); }}>
        <SheetContent side="bottom" className="h-[75vh] p-0 bg-card border-t border-border rounded-t-2xl">
          <MobileVibeCodePanel onClose={() => { setShowVibeCode(false); setActiveTab('editor'); }} />
        </SheetContent>
      </Sheet>

      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="bottom" className="h-[80vh] p-0 bg-card border-t border-border rounded-t-2xl">
          <MobileSettingsSheet onClose={() => setShowSettings(false)} />
        </SheetContent>
      </Sheet>

      <TerrainSettingsModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        settings={modalSettings}
        onSettingsChange={(s) => setModalSettings(prev => ({ ...prev, ...s }))}
        onGenerate={handleTerrainGenerate}
      />
      
      {/* Motion Control Overlay - renders on top when enabled */}
      <MotionControlOverlay />
    </div>
  );
};
