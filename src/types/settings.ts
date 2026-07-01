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
  InstanceSortDir: 'instanceSortDir',
  ShowLogPanel: 'showLogPanel',
  AutoStoreDir: 'autoStoreDir',
  NextflowSyntaxParser: 'nextflowSyntaxParser',
  AutoOutdir: 'autoOutdir',
  OutputPath: 'outputPath',
  StoreDirPath: 'storeDirPath'
} as const;

export type SettingsKey = (typeof SettingsKey)[keyof typeof SettingsKey];
