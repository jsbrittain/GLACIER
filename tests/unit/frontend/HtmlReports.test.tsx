import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HtmlReports from '../../../src/renderer/pages/Monitor/HtmlReports';

const mockInstance = { id: 'test-instance' };

const { mockGetInstanceReportsList } = vi.hoisted(() => ({
  mockGetInstanceReportsList: vi.fn().mockResolvedValue({
    ok: true,
    data: [{ id: 'r1', name: 'Report 1', path: '/reports/r1.html' }]
  })
}));

vi.mock('../../../src/renderer/services/api.js', () => ({
  API: {
    getInstanceReportsList: mockGetInstanceReportsList
  }
}));

describe('HtmlReports', () => {
  beforeEach(() => {
    mockGetInstanceReportsList.mockClear();
  });

  it('renders report list after fetch', async () => {
    render(<HtmlReports instance={mockInstance} />);
    expect(await screen.findByText('Report 1')).toBeInTheDocument();
  });

  it('calls API exactly once on mount', async () => {
    render(<HtmlReports instance={mockInstance} />);
    await screen.findByText('Report 1');
    expect(mockGetInstanceReportsList).toHaveBeenCalledTimes(1);
  });
});
