export interface AccessLevel {
  scope: 'companion_only' | 'persona_api' | 'chat_interface';
  requires: string[];
  allows: string[];
}

export const ACCESS_LEVELS: Record<'STRICT_PRIVATE' | 'RESTRICTED' | 'PUBLIC', AccessLevel> = {
  STRICT_PRIVATE: {
    scope: 'companion_only',
    requires: ['private_key'],
    allows: ['full_content', 'emotional_data']
  },
  RESTRICTED: {
    scope: 'persona_api',
    requires: ['api_key', 'permission_set'],
    allows: ['themed_content', 'filtered_context']
  },
  PUBLIC: {
    scope: 'chat_interface',
    requires: ['public_key'],
    allows: ['approved_topics', 'guardrailed_responses']
  }
};

export interface MemoryAccess {
  id: string;
  accessLevel: AccessLevel;
  allowedEndpoints: string[];
  metadata: Record<string, any>;
}

export class PermissionGuard {
  static async validateAccess(level: keyof typeof ACCESS_LEVELS, providedCredentials: string[]): Promise<boolean> {
    const requiredCredentials = ACCESS_LEVELS[level].requires;
    return requiredCredentials.every(cred => providedCredentials.includes(cred));
  }

  getPermittedActions(level: keyof typeof ACCESS_LEVELS): string[] {
    return ACCESS_LEVELS[level].allows;
  }
}
