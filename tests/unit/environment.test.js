import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/runners/nextflow/environment.js', () => ({
  nextflowStatus: vi.fn(),
  nextflowAction: vi.fn(),
}));

import {
  getEnvironmentStatus,
  performEnvironmentAction,
} from '../../src/runners/environment.js';
import {
  nextflowStatus,
  nextflowAction,
} from '../../src/runners/nextflow/environment.js';

describe('environment dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getEnvironmentStatus delegates to nextflowStatus for nextflow key', async () => {
    nextflowStatus.mockResolvedValue({ ok: true, version: '23.04.0' });
    const result = await getEnvironmentStatus('nextflow');
    expect(nextflowStatus).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, version: '23.04.0' });
  });

  it('getEnvironmentStatus throws for unknown key', async () => {
    await expect(getEnvironmentStatus('unknown')).rejects.toThrow(
      'Unknown environment key: unknown'
    );
  });

  it('performEnvironmentAction delegates to nextflowAction for nextflow key', async () => {
    nextflowAction.mockResolvedValue({ ok: true });
    const result = await performEnvironmentAction('nextflow', 'install.nextflow');
    expect(nextflowAction).toHaveBeenCalledWith('install.nextflow');
    expect(result).toEqual({ ok: true });
  });

  it('performEnvironmentAction throws for unknown key', async () => {
    await expect(performEnvironmentAction('unknown', 'test')).rejects.toThrow(
      'Unknown environment key: unknown'
    );
  });
});
