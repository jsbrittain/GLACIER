// Keep in sync with main/store.js
export const SettingsKey = {
  ConfigPath: 'configPath',
  DocumentsPath: 'documentsPath',
  DarkMode: 'darkMode',
  PermitAddCatalogues: 'permitAddCatalogues',
  PermitCatalogueModifications: 'permitCatalogueModifications',
  PermitImportShards: 'permitImportShards',
  PermitAddRepos: 'permitAddRepos',
  DisableSchemaValidation: 'disableSchemaValidation',
  InstanceSortBy: 'instanceSortBy',
  InstanceSortDir: 'instanceSortDir'
} as const;

export type SettingsKey = (typeof SettingsKey)[keyof typeof SettingsKey];
