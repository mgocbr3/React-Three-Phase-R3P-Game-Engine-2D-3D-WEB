import { useState } from 'react';
import { 
  X, 
  Search, 
  Plus,
  FileCode,
  Play,
  Trash2
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MobileScriptsPanelProps {
  onClose: () => void;
}

const builtInScripts = [
  { id: 'rotate', name: 'Rotate', description: 'Rotação contínua' },
  { id: 'float', name: 'Float', description: 'Movimento flutuante' },
  { id: 'bounce', name: 'Bounce', description: 'Efeito de pulo' },
  { id: 'patrol', name: 'Patrol', description: 'Patrulha entre pontos' },
  { id: 'chase', name: 'Chase', description: 'Persegue o jogador' },
  { id: 'collectible', name: 'Collectible', description: 'Item coletável' },
  { id: 'trigger', name: 'Trigger', description: 'Zona de trigger' },
  { id: 'lookAt', name: 'LookAt', description: 'Olha para alvo' },
];

export const MobileScriptsPanel = ({ onClose }: MobileScriptsPanelProps) => {
  const { selectedObjectId, objects, updateObject } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);
  const attachedScripts = selectedObject?.scriptInstances || [];
  
  const filteredScripts = builtInScripts.filter(script =>
    script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    script.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const attachScript = (scriptId: string) => {
    if (!selectedObjectId) return;
    const newInstance = { 
      id: `${scriptId}-${Date.now()}`, 
      scriptId, 
      enabled: true, 
      parameters: {} 
    };
    updateObject(selectedObjectId, { scriptInstances: [...attachedScripts, newInstance] });
  };

  const removeScript = (scriptId: string) => {
    if (!selectedObjectId) return;
    const newScripts = attachedScripts.filter(s => s.scriptId !== scriptId);
    updateObject(selectedObjectId, { scriptInstances: newScripts });
  };

  const glassStyle = {
    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
    fontFamily: 'Roboto, Noto Sans, sans-serif',
  };

  return (
    <div className="h-full flex flex-col" style={glassStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-primary" />
          <h2 className="text-[15px] font-semibold text-white/90">Scripts</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all"
        >
          <X className="w-4 h-4 text-white/80" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar scripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Attached Scripts */}
          {selectedObject && attachedScripts.length > 0 && (
            <div className="space-y-2">
              <h3 className="px-1 text-[11px] font-medium text-white/45">
                Scripts Anexados
              </h3>
              {attachedScripts.map((script) => {
                const scriptInfo = builtInScripts.find(s => s.id === script.scriptId);
                return (
                  <div 
                    key={script.scriptId}
                    className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20"
                  >
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary" />
                      <span className="text-[13px] font-medium text-white/90">
                        {scriptInfo?.name || script.scriptId}
                      </span>
                    </div>
                    <button 
                      onClick={() => removeScript(script.scriptId)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Available Scripts */}
          <div className="space-y-2">
            <h3 className="px-1 text-[11px] font-medium text-white/45">
              Scripts Disponíveis
            </h3>
            {filteredScripts.map((script) => {
              const isAttached = attachedScripts.some(s => s.scriptId === script.id);
              return (
                <button
                  key={script.id}
                  onClick={() => !isAttached && attachScript(script.id)}
                  disabled={isAttached || !selectedObject}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl transition-all border',
                    isAttached 
                      ? 'bg-white/5 opacity-50 cursor-not-allowed border-transparent'
                      : selectedObject
                        ? 'bg-white/5 hover:bg-white/10 border-white/10 active:bg-white/15'
                        : 'bg-white/5 opacity-50 cursor-not-allowed border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FileCode className="w-4 h-4 text-muted-foreground" />
                    <div className="text-left">
                      <p className="text-[13px] font-medium text-white/90">{script.name}</p>
                      <p className="text-[11px] text-white/50">{script.description}</p>
                    </div>
                  </div>
                  {!isAttached && selectedObject && (
                    <Plus className="w-4 h-4 text-white/40" />
                  )}
                </button>
              );
            })}
          </div>

          {!selectedObject && (
            <div className="text-center py-8 text-white/40">
              <FileCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-medium">Selecione um objeto para anexar scripts</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
