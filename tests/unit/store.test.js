import { describe, it, expect } from 'vitest';
import store from '../../src/main/store.js';

describe('store', () => {
  it('exports an object with get and set methods', () => {
    expect(store).toBeDefined();
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
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
