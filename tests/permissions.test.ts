import { PermissionGuard } from '../src/models/permissions';

describe('PermissionGuard.validateAccess', () => {
  test('resolves to a boolean', async () => {
    const result = await PermissionGuard.validateAccess(
      "PUBLIC",
      ['user1']
    );
    expect(typeof result).toBe('boolean');
  });
});
