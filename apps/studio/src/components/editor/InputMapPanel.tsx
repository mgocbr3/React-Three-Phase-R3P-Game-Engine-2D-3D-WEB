import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Keyboard, Gamepad2, ChevronDown, ChevronRight,
  AlertCircle, Check, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useInputMapStore, 
  InputAction, 
  InputBinding, 
  KeyboardBinding,
  GamepadBinding,
  KEYBOARD_LABELS,
  GAMEPAD_BUTTON_LABELS,
  getBindingLabel
} from '@/stores/inputMapStore';

type DesktopBinding = KeyboardBinding | GamepadBinding;

const desktopBindings = (bindings: InputBinding[]): DesktopBinding[] => (
  bindings
);

// ============ BINDING ICON ============

const BindingTypeIcon = ({ type }: { type: DesktopBinding['type'] }) => {
  switch (type) {
    case 'keyboard':
      return <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'gamepad':
      return <Gamepad2 className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

// ============ KEY CAPTURE MODAL ============

interface KeyCaptureModalProps {
  isOpen: boolean;
  bindingType: DesktopBinding['type'];
  onCapture: (binding: DesktopBinding) => void;
  onClose: () => void;
}

const KeyCaptureModal = ({ isOpen, bindingType, onCapture, onClose }: KeyCaptureModalProps) => {
  const [capturedKey, setCapturedKey] = useState<string | null>(null);
  const [capturedGamepad, setCapturedGamepad] = useState<{ button?: number; axis?: number; dir?: 'positive' | 'negative' } | null>(null);
  const { isKeyBound } = useInputMapStore();
  
  // Keyboard capture
  useEffect(() => {
    if (!isOpen || bindingType !== 'keyboard') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      setCapturedKey(e.code);
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setCapturedKey(`Mouse${e.button}`);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, bindingType]);
  
  // Gamepad capture
  useEffect(() => {
    if (!isOpen || bindingType !== 'gamepad') return;
    
    let animationId: number;
    
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      for (const gamepad of gamepads) {
        if (!gamepad) continue;
        
        // Check buttons
        for (let i = 0; i < gamepad.buttons.length; i++) {
          if (gamepad.buttons[i].pressed) {
            setCapturedGamepad({ button: i });
            return;
          }
        }
        
        // Check axes
        for (let i = 0; i < gamepad.axes.length; i++) {
          if (Math.abs(gamepad.axes[i]) > 0.5) {
            setCapturedGamepad({ 
              axis: i, 
              dir: gamepad.axes[i] > 0 ? 'positive' : 'negative' 
            });
            return;
          }
        }
      }
      animationId = requestAnimationFrame(pollGamepad);
    };
    
    animationId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animationId);
  }, [isOpen, bindingType]);
  
  const handleConfirm = () => {
    if (bindingType === 'keyboard' && capturedKey) {
      const binding: KeyboardBinding = {
        type: 'keyboard',
        code: capturedKey,
        label: KEYBOARD_LABELS[capturedKey] || capturedKey,
      };
      onCapture(binding);
    } else if (bindingType === 'gamepad' && capturedGamepad) {
      const binding: GamepadBinding = {
        type: 'gamepad',
        button: capturedGamepad.button,
        axis: capturedGamepad.axis,
        axisDirection: capturedGamepad.dir,
        label: capturedGamepad.button !== undefined 
          ? GAMEPAD_BUTTON_LABELS[capturedGamepad.button] || `Botão ${capturedGamepad.button}`
          : `Eixo ${capturedGamepad.axis} ${capturedGamepad.dir === 'positive' ? '+' : '-'}`,
      };
      onCapture(binding);
    }
    onClose();
  };
  
  if (!isOpen) return null;
  
  const existingBinding = capturedKey ? isKeyBound(capturedKey) : null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-[400px] rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, hsl(225 15% 14%) 0%, hsl(225 15% 10%) 100%)',
          border: '1px solid hsl(225 12% 22%)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">
            {bindingType === 'keyboard' && 'Capturar Tecla'}
            {bindingType === 'gamepad' && 'Capturar Botão do Controle'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {bindingType === 'keyboard' && (
          <div className="text-center py-8">
            {capturedKey ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 border border-primary/40">
                  <Keyboard className="w-4 h-4 text-primary" />
                  <span className="text-lg font-mono font-bold text-primary">
                    {KEYBOARD_LABELS[capturedKey] || capturedKey}
                  </span>
                </div>
                {existingBinding && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Já usado em "{existingBinding.actionName}"</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Keyboard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Pressione qualquer tecla ou botão do mouse...</p>
              </div>
            )}
          </div>
        )}
        
        {bindingType === 'gamepad' && (
          <div className="text-center py-8">
            {capturedGamepad ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/30 border border-border">
                <Gamepad2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-lg font-bold text-muted-foreground">
                  {capturedGamepad.button !== undefined 
                    ? GAMEPAD_BUTTON_LABELS[capturedGamepad.button] || `Botão ${capturedGamepad.button}`
                    : `Eixo ${capturedGamepad.axis} ${capturedGamepad.dir === 'positive' ? '+' : '-'}`}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Pressione um botão ou mova um analógico...</p>
                <p className="text-xs mt-1 opacity-70">Conecte um controle se não houver nenhum</p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg hover:bg-white/10 text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              (bindingType === 'keyboard' && !capturedKey) ||
              (bindingType === 'gamepad' && !capturedGamepad)
            }
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Check className="w-3.5 h-3.5" />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ ACTION ROW ============

interface ActionRowProps {
  action: InputAction;
  isExpanded: boolean;
  onToggle: () => void;
}

const ActionRow = ({ action, isExpanded, onToggle }: ActionRowProps) => {
  const { removeAction, addBinding, removeBinding } = useInputMapStore();
  const [captureType, setCaptureType] = useState<DesktopBinding['type'] | null>(null);
  const bindings = desktopBindings(action.bindings);
  
  const handleAddBinding = (binding: DesktopBinding) => {
    addBinding(action.id, binding);
  };
  
  return (
    <div 
      className="rounded-lg border overflow-hidden"
      style={{
        background: 'hsl(225 15% 11% / 0.6)',
        borderColor: 'hsl(225 12% 18%)',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium flex-1">{action.name}</span>
        <div className="flex items-center gap-1">
          {bindings.slice(0, 3).map((b, i) => (
            <span 
              key={i}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10"
            >
              {getBindingLabel(b)}
            </span>
          ))}
          {bindings.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{bindings.length - 3}
            </span>
          )}
        </div>
        {!action.isBuiltIn && (
          <button
            onClick={(e) => { e.stopPropagation(); removeAction(action.id); }}
            className="p-1 rounded hover:bg-secondary/30 text-muted-foreground hover:text-muted-foreground"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5">
          {action.description && (
            <p className="text-[11px] text-muted-foreground mb-3">{action.description}</p>
          )}
          
          {/* Bindings List */}
          <div className="space-y-1.5 mb-3">
            {bindings.map((binding, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5"
              >
                <BindingTypeIcon type={binding.type} />
                <span className="text-xs flex-1 font-mono">{getBindingLabel(binding)}</span>
                <button
                  onClick={() => removeBinding(action.id, index)}
                  className="p-0.5 rounded hover:bg-secondary/30 text-muted-foreground hover:text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Add Binding Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setCaptureType('keyboard')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-secondary/30 text-muted-foreground hover:bg-secondary/30"
            >
              <Keyboard className="w-3 h-3" />
              Teclado
            </button>
            <button
              onClick={() => setCaptureType('gamepad')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-secondary/30 text-muted-foreground hover:bg-secondary/30"
            >
              <Gamepad2 className="w-3 h-3" />
              Controle
            </button>
          </div>
        </div>
      )}
      
      {/* Key Capture Modal */}
      {captureType && (
        <KeyCaptureModal
          isOpen={true}
          bindingType={captureType}
          onCapture={handleAddBinding}
          onClose={() => setCaptureType(null)}
        />
      )}
    </div>
  );
};

// ============ ADD ACTION MODAL ============

interface AddActionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddActionModal = ({ isOpen, onClose }: AddActionModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { addAction } = useInputMapStore();
  
  const handleSubmit = () => {
    if (!name.trim()) return;
    addAction({
      name: name.trim(),
      description: description.trim() || undefined,
      bindings: [],
    });
    setName('');
    setDescription('');
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-[360px] rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, hsl(225 15% 14%) 0%, hsl(225 15% 10%) 100%)',
          border: '1px solid hsl(225 12% 22%)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3 className="text-sm font-semibold mb-4">Nova Ação de Input</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Nome da Ação</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Usar Item"
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Descrição (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Usa o item selecionado no inventário"
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg hover:bg-white/10 text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Ação
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN PANEL ============

export const InputMapPanel = () => {
  const { actions } = useInputMapStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">
            Mapa de Inputs
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Configure teclas, mouse e botões de controle
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Ação
        </button>
      </div>
      
      {/* Actions List */}
      <div className="space-y-2">
        {actions.map((action) => (
          <ActionRow
            key={action.id}
            action={action}
            isExpanded={expandedId === action.id}
            onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
          />
        ))}
      </div>
      
      {/* Add Action Modal */}
      <AddActionModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};
