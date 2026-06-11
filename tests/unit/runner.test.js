import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/runners/nextflow/nextflow.js', () => ({
  runWorkflow: vi.fn(async () => 12345)
}));

vi.mock('../../src/runners/docker/docker.js', () => ({
  runRepo_Docker: vi.fn(async () => 'container-id-xyz')
}));

vi.mock('fs', () => {
  const mockStat = vi.fn();
  return {
    promises: { stat: mockStat },
    default: { promises: { stat: mockStat } }
  };
});

import { runWorkflow } from '../../src/main/runner.js';
import { runWorkflow as runWorkflowNextflow } from '../../src/runners/nextflow/nextflow.js';
import { runRepo_Docker } from '../../src/runners/docker/docker.js';

const mockInstance = (path) => ({
  workflow_version: { path },
  name: 'test-instance',
  path: '/some/path/test-instance'
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runner dispatch', () => {
  it('throws when repository path is not a directory', async () => {
    const fsMock = await import('fs');
    fsMock.promises.stat.mockRejectedValue(new Error('ENOENT'));

    await expect(
      runWorkflow({ instance: mockInstance('/nonexistent'), params: {} })
    ).rejects.toThrow('ENOENT');
  });

  it('calls Nextflow runner when nextflow_schema.json exists', async () => {
    const fsMock = await import('fs');
    fsMock.promises.stat.mockImplementation((p) => {
      if (p === '/some/project') return Promise.resolve({ isDirectory: () => true });
      if (p.endsWith('nextflow_schema.json')) return Promise.resolve({ isDirectory: () => false });
      return Promise.reject(new Error('ENOENT'));
    });

    const pid = await runWorkflow({
      instance: mockInstance('/some/project'),
      params: { key: 'val' }
    });

    expect(runWorkflowNextflow).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-instance' }),
      { key: 'val' },
      undefined
    );
    expect(pid).toBe(12345);
  });

  it('calls Docker runner when Dockerfile exists and no nextflow_schema.json', async () => {
    const fsMock = await import('fs');
    fsMock.promises.stat.mockImplementation((p) => {
      if (p === '/some/project') return Promise.resolve({ isDirectory: () => true });
      if (p.endsWith('Dockerfile')) return Promise.resolve({ isDirectory: () => false });
      return Promise.reject(new Error('ENOENT'));
    });

    const id = await runWorkflow({
      instance: mockInstance('/some/project'),
      params: { key: 'val' }
    });

    expect(runRepo_Docker).toHaveBeenCalledWith(
      '/some/project',
      'test-instance',
      { key: 'val' }
    );
    expect(id).toBe('container-id-xyz');
  });

  it('throws when neither nextflow_schema.json nor Dockerfile exists', async () => {
    const fsMock = await import('fs');
    fsMock.promises.stat.mockImplementation((p) => {
      if (p === '/some/project') return Promise.resolve({ isDirectory: () => true });
      return Promise.reject(new Error('ENOENT'));
    });

    await expect(
      runWorkflow({ instance: mockInstance('/some/project'), params: {} })
    ).rejects.toThrow('Unsupported repository type');
  });

  it('throws when projectPath is empty', async () => {
    await expect(
      runWorkflow({ instance: mockInstance(''), params: {} })
    ).rejects.toThrow('Invalid repository path');
  });

  it('passes opts to Nextflow runner when provided', async () => {
    const fsMock = await import('fs');
    fsMock.promises.stat.mockImplementation((p) => {
      if (p === '/some/project') return Promise.resolve({ isDirectory: () => true });
      if (p.endsWith('nextflow_schema.json')) return Promise.resolve({ isDirectory: () => false });
      return Promise.reject(new Error('ENOENT'));
    });

    await runWorkflow({
      instance: mockInstance('/some/project'),
      params: {},
      opts: { resume: true, profile: 'test' }
    });

    expect(runWorkflowNextflow).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { resume: true, profile: 'test' }
    );
  });
});
