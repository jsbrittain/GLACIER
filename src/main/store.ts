import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Keep in sync with types/settings.js
export interface StoreSchema {
  configPath: string;
  documentsPath: string;
  darkMode: boolean;
  permitAddCatalogues: boolean;
  permitCatalogueModifications: boolean;
  permitImportShards: boolean;
  permitAddRepos: boolean;
  disableSchemaValidation: boolean;
  instanceSortBy: string;
  instanceSortDir: string;
  showLogPanel: boolean;
  autoStoreDir: boolean;
  nextflowSyntaxParser: string;
}

let _instance: any = null;

function getInstance() {
  if (_instance === null) {
    try {
      const { default: Store }: any = require('electron-store');
      const { app: electronApp } = require('electron');
      _instance = new Store({
        schema: {
          configPath: { type: 'string', default: '' },
          documentsPath: { type: 'string', default: '' },
          darkMode: { type: 'boolean', default: false },
          permitAddCatalogues: { type: 'boolean', default: true },
          permitCatalogueModifications: { type: 'boolean', default: true },
          permitImportShards: { type: 'boolean', default: true },
          permitAddRepos: { type: 'boolean', default: true },
          disableSchemaValidation: { type: 'boolean', default: false },
          instanceSortBy: { type: 'string', default: 'name' },
          instanceSortDir: { type: 'string', default: 'asc' },
          showLogPanel: { type: 'boolean', default: false },
          autoStoreDir: { type: 'boolean', default: true },
          nextflowSyntaxParser: { type: 'string', default: '1' }
        },
        name: 'config',
        projectName: 'GLACIER',
        cwd: path.join(electronApp.getPath('userData'), 'Library')
      });
    } catch {
      const data = new Map<string, any>();
      _instance = {
        get(key: string, defaultValue?: any) {
          return data.has(key) ? data.get(key) : defaultValue;
        },
        set(key: string, value: any) {
          data.set(key, value);
        }
      };
    }
  }
  return _instance;
}

const store = {
  get<K extends keyof StoreSchema>(
    key: K,
    defaultValue?: StoreSchema[K]
  ): StoreSchema[K] | undefined {
    return getInstance().get(key, defaultValue);
  },
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    getInstance().set(key, value);
  },
  get path(): string | undefined {
    return getInstance().path;
  }
};

export default store;
