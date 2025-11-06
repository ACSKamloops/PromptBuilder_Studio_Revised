import { describe, it, expect } from 'vitest';
import { deriveFlowRecommendations } from '@/components/studio-shell';

const BASE_FLOW = {
  id: 'test-flow',
  name: 'Test Flow',
  description: 'Test',
  nodeIds: [] as string[],
};

describe('deriveFlowRecommendations', () => {
  it('suggests Chain of Verification after RAG', () => {
    const recs = deriveFlowRecommendations({ ...BASE_FLOW, nodeIds: ['system-mandate', 'rag-retriever'] });
    expect(recs.some((rec) => rec.includes('Chain of Verification'))).toBe(true);
  });

  it('suggests Exclusion Check when missing and suppresses when present', () => {
    const recsMissing = deriveFlowRecommendations({ ...BASE_FLOW, nodeIds: ['rag-retriever'] });
    expect(recsMissing.some((rec) => rec.includes('Exclusion Check'))).toBe(true);
    const recsSatisfied = deriveFlowRecommendations({ ...BASE_FLOW, nodeIds: ['rag-retriever', 'exclusion-check', 'cov'] });
    expect(recsSatisfied.some((rec) => rec.includes('Exclusion Check'))).toBe(false);
  });

  it('returns empty array when recommendations satisfied', () => {
    const nodeIds = ['rag-retriever', 'exclusion-check', 'cov', 'thinking-with-tables', 'table-formatter', 'recursive-self-improvement'];
    const recs = deriveFlowRecommendations({ ...BASE_FLOW, nodeIds });
    expect(recs).toEqual([]);
  });
});
