import Store from 'electron-store';

// Keep in sync with types/settings.js
export interface StoreSchema {
  collectionsPath: string;
  darkMode: boolean;
  permitAddCatalogues: boolean;
  permitCatalogueModifications: boolean;
  permitAddRepos: boolean;
  disableSchemaValidation: boolean;
}

const store = new Store<StoreSchema>({
  schema: {
    collectionsPath: {
      type: 'string',
      default: ''
    },
    darkMode: {
      type: 'boolean',
      default: false
    },
    permitAddCatalogues: {
      type: 'boolean',
      default: true
    },
    permitCatalogueModifications: {
      type: 'boolean',
      default: true
    },
    permitAddRepos: {
      type: 'boolean',
      default: true
    },
    disableSchemaValidation: {
      type: 'boolean',
      default: false
    }
  },
  name: 'GLACIER'
});

export default store;
