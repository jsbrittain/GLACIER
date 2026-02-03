// Keep in sync with main/store.js
export const SettingsKey = {
  CollectionsPath: 'collectionsPath',
  DarkMode: 'darkMode',
  PermitAddCatalogues: 'permitAddCatalogues',
  PermitCatalogueModifications: 'permitCatalogueModifications',
  PermitAddRepos: 'permitAddRepos',
  DisableSchemaValidation: 'disableSchemaValidation'
} as const;

export type SettingsKey = (typeof SettingsKey)[keyof typeof SettingsKey];
