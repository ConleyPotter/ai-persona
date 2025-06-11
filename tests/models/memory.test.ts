import { ACCESS_LEVELS } from '../../src/models/permissions';
import type { JournalEntry } from '../../src/models/memory';

describe('JournalEntry interface', () => {
  it('allows creation of a journal entry object', () => {
    const entry: JournalEntry = {
      id: '1',
      embedding: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      content: 'text',
      emotionalMarkers: [],
      themes: [],
      publicElevationBlocked: false,
      accessLevel: ACCESS_LEVELS.STRICT_PRIVATE,
    };

    expect(entry.accessLevel.scope).toBe('companion_only');
  });
});
