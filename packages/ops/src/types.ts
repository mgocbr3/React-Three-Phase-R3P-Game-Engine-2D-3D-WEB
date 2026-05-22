// Wire types shared by all transports (editor, CLI, MCP, HTTP+WS).
// See GDD §8 for the canonical definitions.

export type AgentKind = 'editor' | 'cli' | 'mcp' | 'http' | 'test';

export interface OpContext {
  /** Absolute path to the project folder (the one containing project.pixlproject.json). */
  projectDir: string;
  /** Which transport is making this call. Persisted into the broadcast event so consumers can ignore self-originated changes. */
  agent: AgentKind;
  /** Optional human-readable reason. Future Phase will log it; right now it's metadata only. */
  reason?: string;
}

export interface OpResult {
  ok: boolean;
  /** Relative paths (POSIX) of files actually written during this op. */
  changedFiles: string[];
  /** sha256 hex of the post-mutation project document. Empty string when ok=false. */
  contentHash: string;
  validationWarnings: string[];
  validationErrors: string[];
}

export type BuildTarget = 'three-web' | 'phaser-web' | 'pixlland';

export type ProjectEvent =
  | { type: 'project.created'; projectDir: string; contentHash: string; byAgent: AgentKind }
  | { type: 'project.opened'; projectDir: string; contentHash: string; byAgent: AgentKind }
  | { type: 'project.closed'; projectDir: string; byAgent: AgentKind }
  | { type: 'project.validated'; projectDir: string; contentHash: string; ok: boolean; byAgent: AgentKind }
  | { type: 'project.packed'; projectDir: string; outPath: string; contentHash: string; byAgent: AgentKind }
  | { type: 'project.unpacked'; projectDir: string; sourcePath: string; contentHash: string; byAgent: AgentKind }
  | { type: 'scene.created'; sceneId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'scene.deleted'; sceneId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'scene.activated'; sceneId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'object.added'; sceneId: string; objectId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'object.updated'; sceneId: string; objectId: string; fields: string[]; contentHash: string; byAgent: AgentKind }
  | { type: 'object.removed'; sceneId: string; objectId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'object.reparented'; sceneId: string; objectId: string; newParentId: string | null; contentHash: string; byAgent: AgentKind }
  | { type: 'object.transformed'; sceneId: string; objectId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'object.component.set'; sceneId: string; objectId: string; componentId: string; action: 'added' | 'updated' | 'removed'; contentHash: string; byAgent: AgentKind }
  | { type: 'asset.imported'; assetId: string; path: string; contentHash: string; byAgent: AgentKind }
  | { type: 'asset.removed'; assetId: string; contentHash: string; byAgent: AgentKind }
  | { type: 'script.read'; path: string; byAgent: AgentKind }
  | { type: 'script.written'; path: string; contentHash: string; byAgent: AgentKind }
  | { type: 'script.deleted'; path: string; contentHash: string; byAgent: AgentKind }
  | { type: 'build.completed'; target: BuildTarget; outDir: string; byAgent: AgentKind };

export type ProjectEventListener = (event: ProjectEvent) => void;

/** Thrown by validate() when a pre/post-mutation document is invalid.
 *  Caught inside runLocked; never leaks out of an op as an exception — always
 *  surfaces in the OpResult instead. */
export class OpValidationError extends Error {
  readonly errors: string[];
  readonly warnings: string[];
  constructor(errors: string[], warnings: string[]) {
    super(errors[0] ?? 'Op validation failed');
    this.name = 'OpValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

/** Thrown when an op argument is invalid (e.g., sceneId does not exist).
 *  Same handling as OpValidationError: caught by runLocked, surfaces as
 *  OpResult.validationErrors. */
export class OpInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpInputError';
  }
}
