// Main entry point for the scripting system

// Import all built-in scripts (auto-registers them)
import './built-in';

// Export core modules
export { scriptRegistry } from './registry';
export { scriptExecutor } from './executor';
export { eventBus } from './events';
export { inputManager } from './input';

// Export types
export type {
  GameScript,
  ScriptContext,
  ScriptParameter,
  ScriptInstance,
  ScriptRuntimeState,
} from './types';
