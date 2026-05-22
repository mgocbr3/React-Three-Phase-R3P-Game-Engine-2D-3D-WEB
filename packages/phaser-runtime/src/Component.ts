// Component base class. Shape mirrors @pixlland/three-runtime/Component
// so editor code can target both runtimes through a common interface.

import type { ComponentJSON } from './types.js';

export interface ComponentTickContext {
  /** Seconds since the last tick. */
  delta: number;
  /** Total elapsed seconds since the Game started. */
  elapsed: number;
}

export default class Component {
  readonly type: string;
  enabled: boolean;
  protected props: Record<string, unknown>;

  constructor(json: ComponentJSON) {
    if (!json.type) throw new Error('Component: type is required');
    this.type = json.type;
    this.enabled = json.enabled !== false;
    const { type: _type, enabled: _enabled, ...rest } = json;
    void _type;
    void _enabled;
    this.props = { ...rest };
  }

  /** Override in subclasses. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tick(_ctx: ComponentTickContext): void {
    // no-op
  }

  /** Round-trip back to JSON. */
  toJSON(): ComponentJSON {
    return {
      type: this.type,
      enabled: this.enabled,
      ...this.props,
    };
  }
}
