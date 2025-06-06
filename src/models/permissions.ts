export enum AccessLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export interface MemoryAccess {
  id: string;
  accessLevel: AccessLevel;
  allowedEndpoints: string[];
  metadata: Record<string, any>;
}

export class PermissionGuard {
  static async validateAccess(userId: string, accessLevel: AccessLevel): Promise<boolean> {
    // TODO: implement real permission logic
    return true;
  }
}
