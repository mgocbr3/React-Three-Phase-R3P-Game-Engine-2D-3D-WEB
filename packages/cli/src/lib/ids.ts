import { randomUUID } from 'node:crypto';

export const shortId = (prefix: string): string => `${prefix}_${randomUUID().slice(0, 8)}`;
