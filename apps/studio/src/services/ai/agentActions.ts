// Agent Actions - Parse and execute AI commands on the scene
import { useEditorStore, type ObjectType, type SceneObject } from '@/stores/editorStore';
import { toast } from 'sonner';

export interface AgentAction {
  action: string;
  params: Record<string, any>;
}

// Parse agent actions from AI response
export const parseAgentActions = (content: string): AgentAction[] => {
  const actions: AgentAction[] = [];
  
  // Match ```agent-action blocks
  const actionBlockRegex = /```agent-action\s*([\s\S]*?)```/g;
  let match;
  
  while ((match = actionBlockRegex.exec(content)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const action = JSON.parse(jsonStr);
      if (action.action && action.params) {
        actions.push(action);
      }
    } catch (e) {
      console.warn('[AgentActions] Failed to parse action block:', e);
    }
  }
  
  return actions;
};

// Remove thinking blocks from AI response (common in reasoning models like Qwen)
export const cleanThinkingBlocks = (content: string): string => {
  let cleaned = content;
  
  // Remove complete <think>...</think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Handle incomplete <think> blocks during streaming
  const thinkStart = cleaned.toLowerCase().indexOf('<think>');
  if (thinkStart !== -1) {
    const thinkEnd = cleaned.toLowerCase().indexOf('</think>', thinkStart);
    if (thinkEnd === -1) {
      // Still in thinking mode - show what comes before <think> + indicator
      const beforeThink = cleaned.substring(0, thinkStart).trim();
      return beforeThink || ' Processando...';
    }
  }
  
  return cleaned.trim() || '';
};

// Remove action blocks from response for clean display
export const cleanResponseContent = (content: string): string => {
  let cleaned = content;
  // First remove thinking blocks
  cleaned = cleanThinkingBlocks(cleaned);
  // Then remove agent-action blocks
  cleaned = cleaned.replace(/```agent-action\s*[\s\S]*?```/g, '').trim();
  return cleaned;
};

// Execute a single agent action
export const executeAgentAction = (action: AgentAction): { success: boolean; message: string } => {
  const store = useEditorStore.getState();
  
  try {
    switch (action.action) {
      case 'add_object': {
        const { type, name, position, rotation, scale, color, physicsSettings, visualSettings, logicSettings, audioSettings } = action.params;
        
        if (!type) {
          return { success: false, message: 'Tipo de objeto não especificado' };
        }
        
        // Add the object
        store.addObject(type as ObjectType, position || [0, 1, 0]);
        
        // Get the newly added object (last in array)
        const objects = useEditorStore.getState().objects;
        const newObj = objects[objects.length - 1];
        
        if (newObj) {
          // Apply custom properties
          const updates: Partial<SceneObject> = {};
          
          if (name) updates.name = name;
          if (rotation) updates.rotation = rotation;
          if (scale) updates.scale = scale;
          if (color) updates.color = color;
          if (physicsSettings) updates.physicsSettings = { ...newObj.physicsSettings, ...physicsSettings };
          if (visualSettings) updates.visualSettings = { ...newObj.visualSettings, ...visualSettings };
          if (logicSettings) updates.logicSettings = { ...newObj.logicSettings, ...logicSettings };
          if (audioSettings) updates.audioSettings = { ...newObj.audioSettings, ...audioSettings };
          
          if (Object.keys(updates).length > 0) {
            store.updateObject(newObj.id, updates);
          }
        }
        
        return { success: true, message: `Objeto "${name || type}" criado!` };
      }
      
      case 'update_object': {
        const { name, id, updates } = action.params;
        const objects = store.objects;
        
        // Find object by name or id
        const obj = objects.find(o => 
          (name && o.name.toLowerCase() === name.toLowerCase()) ||
          (id && o.id === id)
        );
        
        if (!obj) {
          return { success: false, message: `Objeto "${name || id}" não encontrado` };
        }
        
        // Apply updates with proper merging
        const mergedUpdates: Partial<SceneObject> = {};
        
        for (const [key, value] of Object.entries(updates)) {
          if (key === 'physicsSettings' && obj.physicsSettings && typeof value === 'object' && value !== null) {
            mergedUpdates.physicsSettings = { ...obj.physicsSettings, ...(value as object) };
          } else if (key === 'visualSettings' && obj.visualSettings && typeof value === 'object' && value !== null) {
            mergedUpdates.visualSettings = { ...obj.visualSettings, ...(value as object) };
          } else if (key === 'logicSettings' && obj.logicSettings && typeof value === 'object' && value !== null) {
            mergedUpdates.logicSettings = { ...obj.logicSettings, ...(value as object) };
          } else if (key === 'playerSettings' && obj.playerSettings && typeof value === 'object' && value !== null) {
            mergedUpdates.playerSettings = { ...obj.playerSettings, ...(value as object) };
          } else if (key === 'cameraSettings' && obj.cameraSettings && typeof value === 'object' && value !== null) {
            mergedUpdates.cameraSettings = { ...obj.cameraSettings, ...(value as object) };
          } else {
            (mergedUpdates as any)[key] = value;
          }
        }
        
        store.updateObject(obj.id, mergedUpdates);
        return { success: true, message: `Objeto "${obj.name}" atualizado!` };
      }
      
      case 'delete_object': {
        const { name, id } = action.params;
        const objects = store.objects;
        
        const obj = objects.find(o => 
          (name && o.name.toLowerCase() === name.toLowerCase()) ||
          (id && o.id === id)
        );
        
        if (!obj) {
          return { success: false, message: `Objeto "${name || id}" não encontrado` };
        }
        
        // Don't allow deleting player or camera
        if (obj.type === 'player' || obj.type === 'camera') {
          return { success: false, message: `Não é possível deletar ${obj.type}` };
        }
        
        store.deleteObject(obj.id);
        return { success: true, message: `Objeto "${obj.name}" removido!` };
      }
      
      case 'add_script': {
        const { objectName, objectId, scriptId, parameters } = action.params;
        const objects = store.objects;
        
        const obj = objects.find(o => 
          (objectName && o.name.toLowerCase() === objectName.toLowerCase()) ||
          (objectId && o.id === objectId)
        );
        
        if (!obj) {
          return { success: false, message: `Objeto "${objectName || objectId}" não encontrado` };
        }
        
        store.addScriptToObject(obj.id, scriptId, parameters || {});
        return { success: true, message: `Script "${scriptId}" adicionado a "${obj.name}"!` };
      }
      
      case 'update_player': {
        const player = store.objects.find(o => o.type === 'player');
        
        if (!player) {
          return { success: false, message: 'Player não encontrado na cena' };
        }
        
        const updates: Partial<SceneObject> = {
          playerSettings: {
            ...player.playerSettings!,
            ...action.params,
          },
        };
        
        store.updateObject(player.id, updates);
        return { success: true, message: 'Configurações do Player atualizadas!' };
      }
      
      case 'update_camera': {
        const camera = store.objects.find(o => o.type === 'camera');
        
        if (!camera) {
          return { success: false, message: 'Câmera não encontrada na cena' };
        }
        
        const updates: Partial<SceneObject> = {
          cameraSettings: {
            ...camera.cameraSettings!,
            ...action.params,
          },
        };
        
        store.updateObject(camera.id, updates);
        return { success: true, message: 'Configurações da Câmera atualizadas!' };
      }
      
      case 'create_group': {
        const { name, objects: groupObjects } = action.params;
        
        if (!groupObjects || !Array.isArray(groupObjects)) {
          return { success: false, message: 'Lista de objetos inválida' };
        }
        
        // Create each object in the group
        let createdCount = 0;
        for (const objDef of groupObjects) {
          const { type, position, rotation, scale, color, ...rest } = objDef;
          
          store.addObject(type as ObjectType, position || [0, 1, 0]);
          
          const objects = useEditorStore.getState().objects;
          const newObj = objects[objects.length - 1];
          
          if (newObj) {
            const updates: Partial<SceneObject> = {};
            if (rotation) updates.rotation = rotation;
            if (scale) updates.scale = scale;
            if (color) updates.color = color;
            
            // Apply any additional settings
            if (rest.physicsSettings) updates.physicsSettings = { ...newObj.physicsSettings, ...rest.physicsSettings };
            if (rest.logicSettings) updates.logicSettings = { ...newObj.logicSettings, ...rest.logicSettings };
            
            store.updateObject(newObj.id, updates);
            createdCount++;
          }
        }
        
        return { success: true, message: `Grupo "${name}" criado com ${createdCount} objetos!` };
      }
      
      default:
        return { success: false, message: `Ação desconhecida: ${action.action}` };
    }
  } catch (error) {
    console.error('[AgentActions] Error executing action:', error);
    return { success: false, message: `Erro ao executar ação: ${error}` };
  }
};

// Execute all actions from AI response
export const executeAllActions = (actions: AgentAction[]): { executed: number; failed: number; messages: string[] } => {
  const results = {
    executed: 0,
    failed: 0,
    messages: [] as string[],
  };
  
  // Save to history before making changes
  const store = useEditorStore.getState();
  store.saveToHistory();
  
  for (const action of actions) {
    const result = executeAgentAction(action);
    
    if (result.success) {
      results.executed++;
      toast.success(result.message, { duration: 2000 });
    } else {
      results.failed++;
      toast.error(result.message, { duration: 3000 });
    }
    
    results.messages.push(result.message);
  }
  
  return results;
};
