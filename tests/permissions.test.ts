import { PermissionGuard, AccessLevel } from '../src/models/permissions';

describe('PermissionGuard.validateAccess', () => {
  test('resolves to a boolean', async () => {
    const result = await PermissionGuard.validateAccess(
      'user1',
      AccessLevel.PUBLIC
    );
    expect(typeof result).toBe('boolean');
  });
});
