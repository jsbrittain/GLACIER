import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('../../src/main/store.js', () => ({
  default: mockStore,
}));

import { settings } from '../../src/main/settings.js';

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get delegates to store.get', () => {
    mockStore.get.mockReturnValue('some-path');
    const result = settings.get('configPath');
    expect(mockStore.get).toHaveBeenCalledWith('configPath');
    expect(result).toBe('some-path');
  });

  it('set delegates to store.set', () => {
    settings.set('darkMode', true);
    expect(mockStore.set).toHaveBeenCalledWith('darkMode', true);
  });
});
