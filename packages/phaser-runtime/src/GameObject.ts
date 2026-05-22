// GameObject: thin wrapper around a Phaser game object (Sprite, Image,
// Container, etc.). The wrapper carries our component list and exposes
// a deterministic API the editor can drive; the actual Phaser instance
// is created by the consumer (studio Phaser mount) when it boots.

import Component from './Component.js';
import type { ComponentJSON, GameObjectJSON } from './types.js';

const cloneTransform = (json: GameObjectJSON): GameObjectJSON['transform'] => ({
  position: { ...json.transform.position },
  rotation: json.transform.rotation,
  scale: { ...json.transform.scale },
});

export default class GameObject {
  readonly id: string;
  name: string;
  readonly type: string;
  transform: GameObjectJSON['transform'];
  visible: boolean;
  locked: boolean;
  tags: string[];
  data: Record<string, unknown>;
  components: Component[];
  children: GameObject[];
  parent: GameObject | null = null;

  constructor(json: GameObjectJSON) {
    if (!json.id) throw new Error('GameObject: id required');
    if (!json.type) throw new Error('GameObject: type required');
    this.id = json.id;
    this.name = json.name || json.id;
    this.type = json.type;
    this.transform = cloneTransform(json);
    this.visible = json.visible !== false;
    this.locked = json.locked === true;
    this.tags = [...(json.tags ?? [])];
    this.data = { ...(json.data ?? {}) };
    this.components = (json.components ?? []).map((c) => new Component(c));
    this.children = (json.children ?? []).map((child) => {
      const go = new GameObject(child);
      go.parent = this;
      return go;
    });
  }

  addComponent(json: ComponentJSON): Component {
    const cmp = new Component(json);
    this.components.push(cmp);
    return cmp;
  }

  addChild(child: GameObject): void {
    child.parent = this;
    this.children.push(child);
  }

  removeChild(id: string): boolean {
    const idx = this.children.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    this.children[idx].parent = null;
    this.children.splice(idx, 1);
    return true;
  }

  findChild(id: string): GameObject | undefined {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findChild(id);
      if (found) return found;
    }
    return undefined;
  }

  toJSON(): GameObjectJSON {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      transform: cloneTransform({ transform: this.transform } as GameObjectJSON),
      visible: this.visible,
      locked: this.locked,
      tags: [...this.tags],
      data: { ...this.data },
      components: this.components.map((c) => c.toJSON()),
      children: this.children.length ? this.children.map((c) => c.toJSON()) : undefined,
    };
  }
}
