// Stable id generators for ops that create new entities (scenes, objects,
// components, assets). Centralized so tests can mock when determinism matters.

import { randomUUID } from 'node:crypto';

export type IdGenerator = () => string;

let generator: IdGenerator = () => randomUUID();

export const setIdGenerator = (next: IdGenerator): void => {
  generator = next;
};

export const resetIdGenerator = (): void => {
  generator = () => randomUUID();
};

export const generateId = (prefix: string): string => `${prefix}_${generator().slice(0, 8)}`;
