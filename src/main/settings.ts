import store, { StoreSchema } from './store.js';
export { StoreSchema } from './store.js';

export const settings = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] | undefined {
    return store.get(key);
  },

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    store.set(key, value);
  }
};
