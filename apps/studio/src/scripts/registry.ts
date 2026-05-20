import type { GameScript } from './types';

class ScriptRegistry {
  private scripts: Map<string, GameScript> = new Map();

  register(script: GameScript): void {
    if (this.scripts.has(script.id)) {
      console.warn(`Script "${script.id}" already registered, overwriting.`);
    }
    this.scripts.set(script.id, script);
  }

  unregister(id: string): boolean {
    return this.scripts.delete(id);
  }

  get(id: string): GameScript | undefined {
    return this.scripts.get(id);
  }

  has(id: string): boolean {
    return this.scripts.has(id);
  }

  getAll(): GameScript[] {
    return Array.from(this.scripts.values());
  }

  getByCategory(category: GameScript['category']): GameScript[] {
    return this.getAll().filter(s => s.category === category);
  }

  getBuiltIn(): GameScript[] {
    return this.getAll().filter(s => s.id.startsWith('builtin:'));
  }

  getCustom(): GameScript[] {
    return this.getAll().filter(s => !s.id.startsWith('builtin:'));
  }

  clear(): void {
    this.scripts.clear();
  }
}

export const scriptRegistry = new ScriptRegistry();
