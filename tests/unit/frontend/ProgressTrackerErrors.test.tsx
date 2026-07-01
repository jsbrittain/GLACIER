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

describe('ProgressTracker — command error display', () => {
  beforeEach(() => {
    mockGetInstanceProgress.mockClear();
  });

  it('shows command error section for errored process', async () => {
    const groupEntry = {
      name: 'OOMER',
      process: [
        {
          time: '12:00:00',
          full_name: 'OOMER',
          status: 'error',
          exitStatus: '137',
          commandError: 'Simulating out-of-memory error: process killed (exit code 137)',
          cause: 'Process `OOMER` terminated with an error exit status (137)'
        }
      ],
      group: []
    };
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress(
        [
          { time: '12:00:00', status: 'running' },
          { time: '12:00:01', status: 'failed', cause: 'Process terminated' },
          { time: '12:00:02', status: 'completed' }
        ],
        [groupEntry]
      )
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(
      await screen.findByText('Simulating out-of-memory error: process killed (exit code 137)')
    ).toBeInTheDocument();
  });

  it('shows OOM chip for exit code 137', async () => {
    const groupEntry = {
      name: 'OOMER',
      process: [
        {
          time: '12:00:00',
          full_name: 'OOMER',
          status: 'error',
          exitStatus: '137',
          commandError: 'out of memory',
          cause: 'Process terminated (137)'
        }
      ],
      group: []
    };
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress(
        [
          { time: '12:00:00', status: 'running' },
          { time: '12:00:01', status: 'failed' },
          { time: '12:00:02', status: 'completed' }
        ],
        [groupEntry]
      )
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(await screen.findByText('monitor.progress.oom-killed')).toBeInTheDocument();
  });

  it('shows exit status chip for non-137 exit code', async () => {
    const groupEntry = {
      name: 'failing-proc',
      process: [
        {
          time: '12:00:00',
          full_name: 'failing-proc',
          status: 'error',
          exitStatus: '1',
          commandError: 'generic error',
          cause: 'Process terminated (1)'
        }
      ],
      group: []
    };
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress(
        [
          { time: '12:00:00', status: 'running' },
          { time: '12:00:01', status: 'failed' },
          { time: '12:00:02', status: 'completed' }
        ],
        [groupEntry]
      )
    });

    render(<ProgressTracker instance={mockInstance} />);

    expect(await screen.findByText('monitor.progress.exit-status')).toBeInTheDocument();
  });

  it('does not show command error section for completed process', async () => {
    const groupEntry = {
      name: 'success',
      process: [
        {
          time: '12:00:00',
          full_name: 'success',
          status: 'completed'
        }
      ],
      group: []
    };
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: makeProgress(
        [
          { time: '12:00:00', status: 'running' },
          { time: '12:00:01', status: 'completed' }
        ],
        [groupEntry]
      )
    });

    render(<ProgressTracker instance={mockInstance} />);

    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText('monitor.progress.command-error')).not.toBeInTheDocument();
  });
});
