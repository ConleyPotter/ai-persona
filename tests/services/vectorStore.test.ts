import { VectorStoreService } from '../../src/services/vectorStore';
import type { AccessLevel } from '../../src/models/permissions';

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    upsert: jest.fn(),
    search: jest.fn().mockResolvedValue([]),
  }))
}));

jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2]),
  }))
}));

const { QdrantClient } = require('@qdrant/js-client-rest');
const { OpenAIEmbeddings } = require('@langchain/openai');

const dummyAccess: AccessLevel = {
  scope: 'companion_only',
  requires: [],
  allows: [],
};

describe('VectorStoreService.queryMemory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls search on appropriate collection', async () => {
    const searchMock = jest.fn().mockResolvedValue([]);
    (QdrantClient as jest.Mock).mockImplementation(() => ({
      upsert: jest.fn(),
      search: searchMock,
    }));

    const service = new VectorStoreService();
    await service.queryMemory('question', dummyAccess);

    expect(searchMock).toHaveBeenCalledWith('journal_entries', expect.any(Object));
  });
});
