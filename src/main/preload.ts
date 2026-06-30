const { contextBridge, ipcRenderer } = require('electron'); // must be CommonJS for electron

contextBridge.exposeInMainWorld('electronAPI', {
  init: () => ipcRenderer.invoke('init'),
  createWorkflowInstance: (workflow_id: string, version: string) =>
    ipcRenderer.invoke('create-workflow-instance', workflow_id, version),
  runWorkflow: (instance: any, params: any, opts: any) =>
    ipcRenderer.invoke('run-workflow', instance, params, opts),
  listWorkflowInstances: () => ipcRenderer.invoke('list-workflow-instances'),
  getWorkflowInstanceLogs: (instance: any, logType: string) =>
    ipcRenderer.invoke('get-workflow-instance-logs', instance, logType),
  getInstanceProgress: (instance: any) => ipcRenderer.invoke('get-instance-progress', instance),
  getWorkflowInstanceParams: (instance: any) =>
    ipcRenderer.invoke('get-workflow-instance-params', instance),
  cancelWorkflowInstance: (instance: any) =>
    ipcRenderer.invoke('cancel-workflow-instance', instance),
  resetWorkflowInstanceStatus: (instance: any) =>
    ipcRenderer.invoke('reset-workflow-instance-status', instance),
  killWorkflowInstance: (instance: any) => ipcRenderer.invoke('kill-workflow-instance', instance),
  deleteWorkflowInstance: (instance: any) =>
    ipcRenderer.invoke('delete-workflow-instance', instance),
  openResultsFolder: (instance: any) => ipcRenderer.invoke('open-results-folder', instance),
  updateWorkflowInstanceStatus: (instance: any) =>
    ipcRenderer.invoke('update-workflow-instance-status', instance),
  getInstanceReportsList: (instance: any) =>
    ipcRenderer.invoke('get-instance-reports-list', instance),
  openWorkFolder: (instance: any, work_id: string) =>
    ipcRenderer.invoke('open-work-folder', instance, work_id),
  openLogFile: (instance: any, log_type: string) =>
    ipcRenderer.invoke('open-log-file', instance, log_type),
  openWorkLogFile: (instance: any, workID: string, logType: string) =>
    ipcRenderer.invoke('open-work-log-file', instance, workID, logType),
  getWorkLog: (instance: any, workID: string, logType: string) =>
    ipcRenderer.invoke('get-work-log', instance, workID, logType),
  getAvailableProfiles: (instance: any) => ipcRenderer.invoke('get-available-profiles', instance),
  getSystemResources: () => ipcRenderer.invoke('get-system-resources'),
  importShard: (filePath: string) => ipcRenderer.invoke('import-shard', filePath),
  queryShardStatus: (shardId: string) => ipcRenderer.invoke('query-shard-status', shardId),

  cloneRepo: (repoUrl: string, ver: string, sourceVer?: string) =>
    ipcRenderer.invoke('clone-repo', repoUrl, ver, sourceVer),
  getRepoTags: (repoUrl: string) => ipcRenderer.invoke('get-repo-tags', repoUrl),
  isRepoInstalled: (repoUrl: string, ver: string) =>
    ipcRenderer.invoke('is-repo-installed', repoUrl, ver),
  isValidWorkflowRepo: (repoPath: string) =>
    ipcRenderer.invoke('is-valid-workflow-repo', repoPath),
  getCollectionsPath: () => ipcRenderer.invoke('get-collections-path'),
  setCollectionsPath: (path: string) => ipcRenderer.invoke('set-collections-path', path),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  setConfigPath: (path: string) => ipcRenderer.invoke('set-config-path', path),
  getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
  setDocumentsPath: (path: string) => ipcRenderer.invoke('set-documents-path', path),
  getDefaultPaths: () => ipcRenderer.invoke('get-default-paths'),
  getMissingPaths: () => ipcRenderer.invoke('get-missing-paths'),
  getCollectionRepos: () => ipcRenderer.invoke('get-collection-repos'),
  addCatalogue: (repoUrl: string, version: string) =>
    ipcRenderer.invoke('add-catalogue', repoUrl, version),
  removeCatalogue: (catalogue_name: string) =>
    ipcRenderer.invoke('remove-catalogue', catalogue_name),
  removeCatalogueSection: (catalogue_name: string, section_name: string) =>
    ipcRenderer.invoke('remove-catalogue-section', catalogue_name, section_name),
  hideCatalogueWorkflow: (catalogue_name: string, section_name: string, workflow_name: string) =>
    ipcRenderer.invoke('hide-catalogue-workflow', catalogue_name, section_name, workflow_name),
  hideCatalogueSection: (catalogue_name: string, section_name: string) =>
    ipcRenderer.invoke('hide-catalogue-section', catalogue_name, section_name),
  removeCatalogueWorkflow: (catalogue_name: string, section_name: string, workflow_name: string) =>
    ipcRenderer.invoke('remove-catalogue-workflow', catalogue_name, section_name, workflow_name),
  moveCatalogueWorkflowsToUser: (catalogue_name: string, workflows: Array<{ section: string; name: string }>) =>
    ipcRenderer.invoke('move-catalogue-workflows-to-user', catalogue_name, workflows),
  uninstallCatalogueWorkflow: (catalogue_name: string, section_name: string, workflow_name: string, workflow_version?: string) =>
    ipcRenderer.invoke('uninstall-catalogue-workflow', catalogue_name, section_name, workflow_name, workflow_version),
  updateCatalogueWorkflow: (catalogue_name: string, section_name: string, workflow_name: string) =>
    ipcRenderer.invoke('update-catalogue-workflow', catalogue_name, section_name, workflow_name),
  checkCatalogueWorkflowUpdates: (catalogue_name: string) =>
    ipcRenderer.invoke('check-catalogue-workflow-updates', catalogue_name),
  checkWorkflowUpdates: () => ipcRenderer.invoke('check-workflow-updates'),
  showCatalogueSectionWorkflows: (catalogue_name: string, section_name: string) =>
    ipcRenderer.invoke('show-catalogue-section-workflows', catalogue_name, section_name),
  showCatalogueWorkflows: (catalogue_name: string) =>
    ipcRenderer.invoke('show-catalogue-workflows', catalogue_name),
  showCatalogueSections: (catalogue_name: string) =>
    ipcRenderer.invoke('show-catalogue-sections', catalogue_name),
  getInstalledWorkflowIds: () => ipcRenderer.invoke('get-installed-workflow-ids'),
  getCatalogues: () => ipcRenderer.invoke('get-catalogues'),
  getCatalogueParseResults: () => ipcRenderer.invoke('get-catalogue-parse-results'),
  refreshCatalogues: () => ipcRenderer.invoke('refresh-catalogues'),
  addUserWorkflow: (name: string, repoUrl: string, version: string, section: string) =>
    ipcRenderer.invoke('add-user-workflow', name, repoUrl, version, section),
  syncRepo: (repo: string) => ipcRenderer.invoke('sync-repo', repo),
  getWorkflowParams: (repoPath: string) => ipcRenderer.invoke('get-workflow-params', repoPath),
  pickFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('pick-file', { filters }),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  getWorkflowSchema: (repoPath: string) => ipcRenderer.invoke('get-workflow-schema', repoPath),
  getInstallableReposList: () => ipcRenderer.invoke('get-installable-repos-list'),
  addInstallableRepo: (repoUrl: string) => ipcRenderer.invoke('add-installable-repo', repoUrl),
  getWorkflowInformation: (instance: any) =>
    ipcRenderer.invoke('get-workflow-information', instance),
  getWorkflowReadme: (instance: any) => ipcRenderer.invoke('get-workflow-readme', instance),
  getWorkflowLicense: (instance: any) => ipcRenderer.invoke('get-workflow-license', instance),
  showSaveDialog: (opts: any) => ipcRenderer.invoke('show-save-dialog', opts),
  writeTextFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-text-file', filePath, content),
  readTextFile: (filePath: string) => ipcRenderer.invoke('read-text-file', filePath),
  settingsGet: (key: string) => ipcRenderer.invoke('settings-get', key),
  settingsSet: (key: string, value: any) => ipcRenderer.invoke('settings-set', key, value),
  openWebPage: (url: string) => ipcRenderer.invoke('open-web-page', url),
  getEnvironmentStatus: (key: string) => ipcRenderer.invoke('get-environment-status', key),
  performEnvironmentAction: (key: string, action: string) =>
    ipcRenderer.invoke('perform-environment-action', key, action),
  getInstanceDiskUsage: (instance: any) => ipcRenderer.invoke('get-instance-disk-usage', instance),
  deleteOrphanedInstances: () => ipcRenderer.invoke('delete-orphaned-instances'),
  hideWorkflowInstance: (instance: any) => ipcRenderer.invoke('hide-workflow-instance', instance),
  unhideWorkflowInstance: (instance: any) => ipcRenderer.invoke('unhide-workflow-instance', instance),
  listHiddenInstances: () => ipcRenderer.invoke('list-hidden-instances'),
  exportCatalogue: (name: string, path: string) => ipcRenderer.invoke('export-catalogue', name, path),
  createCatalogueFromFile: (filePath: string) =>
    ipcRenderer.invoke('create-catalogue-from-file', filePath)
});
