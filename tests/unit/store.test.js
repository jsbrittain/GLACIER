import { describe, it, expect, vi } from 'vitest';

vi.mock('electron-store', () => {
  const store = new Map();
  store.set('collectionsPath', '/custom/collections');
  return {
    default: class MockStore {
      constructor() {}
      get(key, defaultValue) {
        return store.has(key) ? store.get(key) : defaultValue;
      }
      set(key, value) {
        store.set(key, value);
      }
    }
  };
});

import store from '../../src/main/store.js';

describe('store', () => {
  it('is instantiated as a Store object', () => {
    expect(store).toBeDefined();
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
  });

  it('has a get method that returns values', () => {
    const val = store.get('collectionsPath');
    expect(val).toBe('/custom/collections');
  });

  it('returns undefined for unset keys without default', () => {
    const val = store.get('darkMode');
    expect(val).toBeUndefined();
  });

  it('returns default for unset keys when provided', () => {
    const val = store.get('darkMode', true);
    expect(val).toBe(true);
  });

  it('allows setting and getting values', () => {
    store.set('darkMode', true);
    expect(store.get('darkMode')).toBe(true);
  });

  it('overwrites existing values on set', () => {
    store.set('darkMode', false);
    expect(store.get('darkMode')).toBe(false);
  });
});
