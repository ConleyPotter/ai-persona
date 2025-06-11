import { LLMService } from '../../src/services/llm';
import { VectorStoreService } from '../../src/services/vectorStore';
import type { AccessLevel } from '../../src/models/permissions';

jest.mock('../../src/services/vectorStore');

const mockQuery = jest.fn();
(VectorStoreService as unknown as jest.Mock).mockImplementation(() => ({
  queryMemory: mockQuery,
}));

// Mock RunnableSequence from langchain so we can control the response
jest.mock('@langchain/core/runnables', () => ({
  RunnableSequence: {
    from: jest.fn().mockReturnValue({
      invoke: jest.fn(),
    })
  }
}));

const { RunnableSequence } = require('@langchain/core/runnables');

const dummyAccess: AccessLevel = {
  scope: 'chat_interface',
  requires: [],
  allows: [],
};

describe('LLMService.generateResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns fallback when no memory is found', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const service = new LLMService();

    const res = await service.generateResponse('hi', dummyAccess);
    expect(res).toEqual({
      text: "I don't have enough information to answer that question.",
      metadata: { confidence: 0, reason: 'no_relevant_context' }
    });
  });

  it('returns answer composed by runnable sequence', async () => {
    const invokeMock = jest.fn().mockResolvedValue('answer');
    (RunnableSequence.from as jest.Mock).mockReturnValue({ invoke: invokeMock });
    mockQuery.mockResolvedValueOnce([{ id: '1', score: 0.9, payload: { text: 'ctx' } }]);

    const service = new LLMService();
    const res = await service.generateResponse('question', dummyAccess);

    expect(invokeMock).toHaveBeenCalled();
    expect(res.text).toBe('answer');
    expect(res.metadata.sources).toEqual(['1']);
    expect(res.metadata.confidence).toBe(0.9);
  });
});
