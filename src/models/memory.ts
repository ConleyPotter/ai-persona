import type { AccessLevel } from './permissions';

export interface MemoryEntry {
  id: string;
  text: string;
  metadata: Record<string, any>;
  accessLevel: AccessLevel;
}
