import { useState, useEffect, useCallback } from 'react';
import { 
  FileCode, Play, Save, X, ChevronDown, ChevronRight, Plus, 
  Trash2, Power, Code, Sparkles, Copy, Download, Upload, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore, SceneObject } from '@/stores/editorStore';
import { scriptRegistry } from '@/scripts/registry';
import { GameScript, ScriptInstance, ScriptParameter } from '@/scripts/types';
import '@/scripts/built-in';

// Script template for new scripts
const getScriptTemplate = (name: string) => `// ${name} - Custom Script
// ==================================

// Called once when the script starts
function onStart(ctx) {
  console.log('${name} started on:', ctx.object.name);
  
  // Initialize state
  ctx.state.timer = 0;
}

// Called every frame
function onUpdate(ctx) {
  const { delta, params, transform } = ctx;
  
  // Example: rotate based on speed parameter
  const speed = params.speed || 1;
  ctx.state.timer += delta;
  
  // Your update logic here
  const rotation = transform.getRotation();
  rotation.y += delta * speed;
  transform.setRotation(rotation.x, rotation.y, rotation.z);
}

// Called when colliding with another object
function onCollisionEnter(ctx, other) {
  console.log('Collision with:', other.name);
}

// Called when entering a trigger zone
function onTriggerEnter(ctx, other) {
  console.log('Trigger entered by:', other.name);
}
`;

interface ScriptEditorPanelProps {
  selectedObject: SceneObject | null;
}

export const ScriptEditorPanel = ({ selectedObject }: ScriptEditorPanelProps) => {
  const { 
    addScriptToObject, 
    removeScriptFromObject, 
    updateScriptParams, 
    toggleScriptEnabled,
    isEditMode 
  } = useEditorStore();
  
  const [showSnippets, setShowSnippets] = useState(false);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [scriptCode, setScriptCode] = useState('');
  const [expandedScripts, setExpandedScripts] = useState<Set<string>>(new Set());

  const builtInScripts = scriptRegistry.getBuiltIn();
  const objectScripts = selectedObject?.scriptInstances || [];

  const toggleExpanded = (instanceId: string) => {
    setExpandedScripts(prev => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const handleAddScript = (scriptId: string) => {
    if (!selectedObject) return;
    const script = scriptRegistry.get(scriptId);
    if (!script) return;

    const defaultParams: Record<string, any> = {};
    script.parameters.forEach(param => {
      defaultParams[param.key] = param.default;
    });

    addScriptToObject(selectedObject.id, scriptId, defaultParams);
    setShowSnippets(false);
  };

  const handleRemoveScript = (instanceId: string) => {
    if (!selectedObject) return;
    removeScriptFromObject(selectedObject.id, instanceId);
  };

  const handleEditScript = (scriptId: string) => {
    const script = scriptRegistry.get(scriptId);
    if (script) {
      // Generate code representation of the script
      const code = generateScriptCode(script);
      setScriptCode(code);
      setEditingScript(scriptId);
    }
  };

  const handleCreateNewScript = () => {
    setScriptCode(getScriptTemplate('NewScript'));
    setEditingScript('new');
  };

  const generateScriptCode = (script: GameScript): string => {
    let code = `// ${script.name}\n// ${script.description}\n// Category: ${script.category}\n\n`;
    
    // Parameters section
    code += `// Parameters:\n`;
    script.parameters.forEach(p => {
      code += `//   ${p.key}: ${p.type} = ${JSON.stringify(p.default)}${p.description ? ` // ${p.description}` : ''}\n`;
    });
    code += '\n';
    
    // Generate function bodies
    if (script.onStart) {
      code += `function onStart(ctx) {\n  // Script initialization\n  ${getFunctionBodyHint('onStart')}\n}\n\n`;
    }
    
    if (script.onUpdate) {
      code += `function onUpdate(ctx) {\n  const { delta, params, transform } = ctx;\n  ${getFunctionBodyHint('onUpdate', script)}\n}\n\n`;
    }
    
    if (script.onCollisionEnter) {
      code += `function onCollisionEnter(ctx, other) {\n  // Handle collision\n}\n\n`;
    }
    
    if (script.onTriggerEnter) {
      code += `function onTriggerEnter(ctx, other) {\n  // Handle trigger\n}\n`;
    }
    
    return code;
  };

  const getFunctionBodyHint = (fn: string, script?: GameScript): string => {
    if (fn === 'onUpdate' && script?.id === 'builtin:rotate') {
      return `const speed = params.speed ?? 1;
  const axis = params.axis ?? 'y';
  const rotation = transform.getRotation();
  rotation[axis] += delta * speed;
  transform.setRotation(rotation.x, rotation.y, rotation.z);`;
    }
    if (fn === 'onUpdate' && script?.id === 'builtin:float') {
      return `const amplitude = params.amplitude ?? 1;
  const frequency = params.frequency ?? 1;
  ctx.state.time = (ctx.state.time || 0) + delta;
  const offset = Math.sin(ctx.state.time * frequency) * amplitude;
  const pos = transform.getPosition();
  transform.setPosition(pos.x, ctx.state.startY + offset, pos.z);`;
    }
    return '// Your logic here';
  };

  // If editing a script, show the code editor
  if (editingScript) {
    return (
      <div className="h-full flex flex-col bg-[#1e1e2e]">
        {/* Editor Header */}
        <div className="flex items-center justify-between p-2 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">
              {editingScript === 'new' ? 'Novo Script' : editingScript.replace('builtin:', '')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSnippets(!showSnippets)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors",
                showSnippets ? "bg-secondary/30 text-muted-foreground" : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
              )}
            >
              <Sparkles className="w-3 h-3" />
              Snippets
            </button>
            <button className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Copiar">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Salvar">
              <Save className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Resetar">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 py-1 bg-[#181825] border-b border-border">
          <div className="flex items-center gap-1 px-2 py-1 bg-card rounded-t text-xs text-foreground">
            <Code className="w-3 h-3" />
            <span>{editingScript === 'new' ? 'new_script.ts' : `${editingScript.replace('builtin:', '')}.ts`}</span>
            <button 
              onClick={() => setEditingScript(null)}
              className="ml-1 hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 flex">
            {/* Line Numbers */}
            <div className="w-10 bg-[#181825] text-right pr-2 pt-2 select-none overflow-hidden">
              {scriptCode.split('\n').map((_, i) => (
                <div key={i} className="text-[10px] text-muted-foreground/50 leading-5 font-mono">
                  {i + 1}
                </div>
              ))}
            </div>
            
            {/* Code Area */}
            <div className="flex-1 overflow-auto">
              <textarea
                value={scriptCode}
                onChange={(e) => setScriptCode(e.target.value)}
                className="w-full h-full bg-transparent text-xs font-mono text-foreground p-2 leading-5 resize-none focus:outline-none"
                spellCheck={false}
                style={{ 
                  tabSize: 2,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
                }}
              />
            </div>
          </div>
        </div>

        {/* Execute Button */}
        <div className="p-2 border-t border-border bg-card flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">JAVASCRIPT • UTF-8</span>
          <button 
            className="flex items-center gap-2 px-4 py-1.5 bg-neon-green text-black rounded text-xs font-semibold hover:bg-neon-green/90 transition-colors"
            onClick={() => {
              console.log('Executing script:', scriptCode);
              setEditingScript(null);
            }}
          >
            <Play className="w-3.5 h-3.5" />
            Executar
          </button>
        </div>
      </div>
    );
  }

  // Main script list view
  if (!selectedObject) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
        <FileCode className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-xs font-medium">Nenhum objeto selecionado</p>
        <p className="text-[10px] mt-1 max-w-[180px] opacity-70">
          Selecione um objeto para gerenciar seus scripts
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Object Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-primary" />
          <div>
            <p className="text-xs font-semibold">{selectedObject.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {objectScripts.length} script{objectScripts.length !== 1 ? 's' : ''} anexado{objectScripts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {!isEditMode && (
          <span className="px-1.5 py-0.5 bg-neon-green/20 text-neon-green text-[9px] font-semibold rounded flex items-center gap-1">
            <Play className="w-2.5 h-2.5" /> ATIVO
          </span>
        )}
      </div>

      {/* Script Instances List */}
      <div className="flex-1 overflow-y-auto">
        {objectScripts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-xs">Nenhum script anexado</p>
            <p className="text-[10px] mt-1 opacity-70">
              Clique em "Adicionar Script" abaixo
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {objectScripts.map((instance) => {
              const script = scriptRegistry.get(instance.scriptId);
              if (!script) return null;
              const isExpanded = expandedScripts.has(instance.id);

              return (
                <div key={instance.id} className="bg-card">
                  {/* Script Row */}
                  <div 
                    className="flex items-center gap-2 p-2 hover:bg-secondary/50 cursor-pointer"
                    onClick={() => toggleExpanded(instance.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                    <Code className="w-3.5 h-3.5 text-primary" />
                    <span className="flex-1 text-xs font-medium">{script.name}</span>
                    
                    {/* Edit Code Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditScript(instance.scriptId);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/15 transition-colors"
                      title="Editar código"
                    >
                      <FileCode className="w-3 h-3" />
                    </button>
                    
                    {/* Toggle Enabled */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScriptEnabled(selectedObject.id, instance.id);
                      }}
                      className={cn(
                        "p-1 rounded transition-colors",
                        instance.enabled 
                          ? "text-neon-green hover:bg-neon-green/20" 
                          : "text-muted-foreground hover:bg-secondary"
                      )}
                      title={instance.enabled ? "Desativar" : "Ativar"}
                    >
                      <Power className="w-3 h-3" />
                    </button>
                    
                    {/* Remove */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveScript(instance.id);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Parameters */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 bg-secondary/30">
                      <p className="text-[10px] text-muted-foreground pt-1">{script.description}</p>
                      
                      {script.parameters.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">
                          Nenhum parâmetro configurável
                        </p>
                      ) : (
                        script.parameters.map((param) => (
                          <ParameterEditor
                            key={param.key}
                            param={param}
                            value={instance.parameters[param.key] ?? param.default}
                            onChange={(value) => updateScriptParams(selectedObject.id, instance.id, { [param.key]: value })}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Script Section */}
      <div className="border-t border-border">
        {/* Snippets / Available Scripts */}
        {showSnippets && (
          <div className="p-2 border-b border-border bg-secondary/30 max-h-48 overflow-y-auto">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              Scripts Disponíveis
            </p>
            <div className="space-y-1">
              {builtInScripts.map((script) => {
                const alreadyAdded = objectScripts.some(s => s.scriptId === script.id);
                return (
                  <button
                    key={script.id}
                    onClick={() => handleAddScript(script.id)}
                    disabled={alreadyAdded}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                      alreadyAdded ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
                    )}
                  >
                    <Code className="w-3.5 h-3.5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{script.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{script.description}</p>
                    </div>
                    {alreadyAdded && (
                      <span className="text-[9px] text-muted-foreground">Adicionado</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-2 flex gap-2 bg-card">
          <button
            onClick={() => setShowSnippets(!showSnippets)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors",
              showSnippets 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-foreground hover:bg-secondary/80"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Snippets
          </button>
          <button
            onClick={handleCreateNewScript}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Script
          </button>
        </div>
      </div>
    </div>
  );
};

// Parameter Editor Component
interface ParameterEditorProps {
  param: ScriptParameter;
  value: any;
  onChange: (value: any) => void;
}

const ParameterEditor = ({ param, value, onChange }: ParameterEditorProps) => {
  switch (param.type) {
    case 'number':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-foreground">{param.label}</label>
            <span className="text-[10px] text-primary font-mono">{typeof value === 'number' ? value.toFixed(1) : value}</span>
          </div>
          <input
            type="range"
            min={param.min ?? 0}
            max={param.max ?? 10}
            step={param.step ?? 0.1}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-primary"
          />
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-foreground">{param.label}</label>
          <button
            onClick={() => onChange(!value)}
            className={cn(
              "w-8 h-4 rounded-full transition-colors relative",
              value ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn(
              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
              value ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground">{param.label}</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-muted border border-border rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case 'color':
      return (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground">{param.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value || '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="w-6 h-6 rounded border-0 cursor-pointer"
            />
            <input
              type="text"
              value={value || '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-muted border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      );

    case 'string':
      return (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground">{param.label}</label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-muted border border-border rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      );

    default:
      return null;
  }
};
