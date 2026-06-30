import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressTracker from '../../../src/renderer/pages/Monitor/ProgressTracker';

const mockInstance = { id: 'test-instance' };

const mockGetInstanceProgress = vi.hoisted(() => vi.fn());

vi.mock('../../../src/renderer/services/api.js', () => ({
  API: {
    getInstanceProgress: mockGetInstanceProgress
  }
}));

function makeProgress(workflowEvents: any[], group: any[] = []) {
  return { workflow: workflowEvents, group };
}

describe('ProgressTracker — error hints', () => {
  beforeEach(() => {
    mockGetInstanceProgress.mockClear();
  });

  it('shows OOM hint when cause contains "out of memory"', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        { time: '12:00:01', status: 'failed', cause: 'Process terminated with out of memory' },
        { time: '12:00:02', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(await screen.findByText('monitor.progress.hint-oom')).toBeInTheDocument();
  });

  it('shows disk hint when cause contains "disk quota"', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        {
          time: '12:00:01',
          status: 'failed',
          cause: 'Disk quota exceeded for user'
        },
        { time: '12:00:02', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(await screen.findByText('monitor.progress.hint-disk')).toBeInTheDocument();
  });

  it('shows timeout hint when cause contains "time limit"', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        {
          time: '12:00:01',
          status: 'failed',
          cause: 'Time limit reached for process'
        },
        { time: '12:00:02', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(await screen.findByText('monitor.progress.hint-timeout')).toBeInTheDocument();
  });

  it('shows permission hint when cause contains "Permission denied"', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        {
          time: '12:00:01',
          status: 'failed',
          cause: 'Permission denied: cannot access file'
        },
        { time: '12:00:02', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(await screen.findByText('monitor.progress.hint-permission')).toBeInTheDocument();
  });

  it('shows no hint for unknown causes', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        { time: '12:00:01', status: 'failed', cause: 'Generic error occurred' },
        { time: '12:00:02', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(/^monitor\.progress\.hint-/)).not.toBeInTheDocument();
  });

  it('shows no hint when workflow is completed successfully', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        { time: '12:00:01', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(/^monitor\.progress\.hint-/)).not.toBeInTheDocument();
  });

  it('shows no hint when there is no cause field', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress([
        { time: '12:00:00', status: 'running' },
        { time: '12:00:01', status: 'failed' },
        { time: '12:00:02', status: 'completed' }
      ])
    });

    render(<ProgressTracker instance={mockInstance} />);

    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(/^monitor\.progress\.hint-/)).not.toBeInTheDocument();
  });
});
