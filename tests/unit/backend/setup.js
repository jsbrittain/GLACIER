import { vi } from 'vitest';

vi.mock('electron', () => {
  const mockShell = {
    openPath: vi.fn(),
    openExternal: vi.fn()
  };
  const mockApp = {
    getPath: vi.fn(() => '/tmp/test-glacier'),
    getAppPath: vi.fn(() => '/app'),
    isPackaged: false
  };
  return {
    default: { shell: mockShell, app: mockApp },
    shell: mockShell,
    app: mockApp,
    ipcMain: { handle: vi.fn() }
  };
});

vi.mock('electron-store', () => {
  const store = new Map();
  return {
    default: class MockStore {
      constructor() {}
      get(key, defaultValue) {
        return store.has(key) ? store.get(key) : defaultValue;
      }
      set(key, value) {
        store.set(key, value);
      }
      delete(key) {
        store.delete(key);
      }
      clear() {
        store.clear();
      }
    }
  };
});
