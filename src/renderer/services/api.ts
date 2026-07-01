const isElectron = Boolean(window?.electronAPI);

const electronAPI = isElectron
  ? {
      init: () => window.electronAPI.init(),
      createWorkflowInstance: (workflow_id, version) =>
        window.electronAPI.createWorkflowInstance(workflow_id, version),
      runWorkflow: (instance, params, opts) =>
        window.electronAPI.runWorkflow(instance, params, opts),
      listWorkflowInstances: () => window.electronAPI.listWorkflowInstances(),
      getWorkflowInstanceLogs: (instance, logType) =>
        window.electronAPI.getWorkflowInstanceLogs(instance, logType),
      getInstanceProgress: (instance) => window.electronAPI.getInstanceProgress(instance),
      getWorkflowInstanceParams: (instance) =>
        window.electronAPI.getWorkflowInstanceParams(instance),
      cancelWorkflowInstance: (instance) => window.electronAPI.cancelWorkflowInstance(instance),
      resetWorkflowInstanceStatus: (instance) =>
        window.electronAPI.resetWorkflowInstanceStatus(instance),
      killWorkflowInstance: (instance) => window.electronAPI.killWorkflowInstance(instance),
      deleteWorkflowInstance: (instance) => window.electronAPI.deleteWorkflowInstance(instance),
      deleteInstanceOutput: (instance) => window.electronAPI.deleteInstanceOutput(instance),
      openResultsFolder: (instance) => window.electronAPI.openResultsFolder(instance),
      openLogFile: (instance, logType) => window.electronAPI.openLogFile(instance, logType),
      openWorkLogFile: (instance, workID, logType) =>
        window.electronAPI.openWorkLogFile(instance, workID, logType),
      updateWorkflowInstanceStatus: (instance) =>
        window.electronAPI.updateWorkflowInstanceStatus(instance),
      getInstanceReportsList: (instance) => window.electronAPI.getInstanceReportsList(instance),
      getPathReportsList: (reportsPath) => window.electronAPI.getPathReportsList(reportsPath),
      getOutputPathForInstance: (instance) => window.electronAPI.getOutputPathForInstance(instance),
      getInstanceReport: (instance, reportFile) =>
        window.electronAPI.getInstanceReport(instance, reportFile),
      openWorkFolder: (instance, workID) => window.electronAPI.openWorkFolder(instance, workID),
      getWorkLog: (instance, workID, logType) =>
        window.electronAPI.getWorkLog(instance, workID, logType),
      getAvailableProfiles: (instance) => window.electronAPI.getAvailableProfiles(instance),
      cloneRepo: (repoUrl, ver, sourceVer) => window.electronAPI.cloneRepo(repoUrl, ver, sourceVer),
      getRepoTags: (repoUrl) => window.electronAPI.getRepoTags(repoUrl),
      isRepoInstalled: (repoUrl, ver) => window.electronAPI.isRepoInstalled(repoUrl, ver),
      isValidWorkflowRepo: (repoPath) => window.electronAPI.isValidWorkflowRepo(repoPath),
      syncRepo: (repo) => window.electronAPI.syncRepo(repo),
      addCatalogue: (repoUrl, ver) => window.electronAPI.addCatalogue(repoUrl, ver),
      removeCatalogue: (catalogue_name) => window.electronAPI.removeCatalogue(catalogue_name),
      removeCatalogueSection: (catalogue_name, section_name) =>
        window.electronAPI.removeCatalogueSection(catalogue_name, section_name),
      hideCatalogueWorkflow: (catalogue_name, section_name, workflow_name) =>
        window.electronAPI.hideCatalogueWorkflow(catalogue_name, section_name, workflow_name),
      hideCatalogueSection: (catalogue_name, section_name) =>
        window.electronAPI.hideCatalogueSection(catalogue_name, section_name),
      removeCatalogueWorkflow: (catalogue_name, section_name, workflow_name) =>
        window.electronAPI.removeCatalogueWorkflow(catalogue_name, section_name, workflow_name),
      moveCatalogueWorkflowsToUser: (catalogue_name, workflows) =>
        window.electronAPI.moveCatalogueWorkflowsToUser(catalogue_name, workflows),
      getInstalledWorkflowIds: () => window.electronAPI.getInstalledWorkflowIds(),
      uninstallCatalogueWorkflow: (catalogue_name, section_name, workflow_name, workflow_version) =>
        window.electronAPI.uninstallCatalogueWorkflow(
          catalogue_name,
          section_name,
          workflow_name,
          workflow_version
        ),
      updateCatalogueWorkflow: (catalogue_name, section_name, workflow_name) =>
        window.electronAPI.updateCatalogueWorkflow(catalogue_name, section_name, workflow_name),
      checkCatalogueWorkflowUpdates: (catalogue_name) =>
        window.electronAPI.checkCatalogueWorkflowUpdates(catalogue_name),
      checkWorkflowUpdates: () => window.electronAPI.checkWorkflowUpdates(),
      showCatalogueSectionWorkflows: (catalogue_name, section_name) =>
        window.electronAPI.showCatalogueSectionWorkflows(catalogue_name, section_name),
      showCatalogueWorkflows: (catalogue_name) =>
        window.electronAPI.showCatalogueWorkflows(catalogue_name),
      showCatalogueSections: (catalogue_name) =>
        window.electronAPI.showCatalogueSections(catalogue_name),
      getCatalogues: () => window.electronAPI.getCatalogues(),
      getCatalogueParseResults: () => window.electronAPI.getCatalogueParseResults(),
      refreshCatalogues: () => window.electronAPI.refreshCatalogues(),
      addUserWorkflow: (name, repoUrl, ver, section) =>
        window.electronAPI.addUserWorkflow(name, repoUrl, ver, section),
      getCollectionRepos: () => window.electronAPI.getCollectionRepos(),
      getCollectionsPath: () => window.electronAPI.getCollectionsPath(),
      setCollectionsPath: (path) => window.electronAPI.setCollectionsPath(path),
      getConfigPath: () => window.electronAPI.getConfigPath(),
      setConfigPath: (path) => window.electronAPI.setConfigPath(path),
      getDocumentsPath: () => window.electronAPI.getDocumentsPath(),
      setDocumentsPath: (path) => window.electronAPI.setDocumentsPath(path),
      getOutputPath: () => window.electronAPI.getOutputPath(),
      setOutputPath: (path) => window.electronAPI.setOutputPath(path),
      getStoreDirPath: () => window.electronAPI.getStoreDirPath(),
      setStoreDirPath: (path) => window.electronAPI.setStoreDirPath(path),
      getDefaultPaths: () => window.electronAPI.getDefaultPaths(),
      getMissingPaths: () => window.electronAPI.getMissingPaths(),
      getContainerLogs: (containerId) => window.electronAPI.getContainerLogs(containerId),
      stopContainer: (containerId) => window.electronAPI.stopContainer(containerId),
      deleteRepo: (repoPath) => window.electronAPI.deleteRepo(repoPath),
      getWorkflowParams: (repoPath) => window.electronAPI.getWorkflowParams(repoPath),
      getWorkflowSchema: (repoPath) => window.electronAPI.getWorkflowSchema(repoPath),
      getInstallableReposList: () => window.electronAPI.getInstallableReposList(),
      addInstallableRepo: (repoUrl) => window.electronAPI.addInstallableRepo(repoUrl),
      getWorkflowInformation: (instance) => window.electronAPI.getWorkflowInformation(instance),
      getWorkflowReadme: (instance) => window.electronAPI.getWorkflowReadme(instance),
      getWorkflowLicense: (instance) => window.electronAPI.getWorkflowLicense(instance),
      settingsGet: (key) => window.electronAPI.settingsGet(key),
      settingsSet: (key, value) => window.electronAPI.settingsSet(key, value),
      openWebPage: (url) => window.electronAPI.openWebPage(url),
      getEnvironmentStatus: (key) => window.electronAPI.getEnvironmentStatus(key),
      performEnvironmentAction: (key, action) =>
        window.electronAPI.performEnvironmentAction(key, action),
      getSystemResources: () => window.electronAPI.getSystemResources(),
      pickFile: (filters) => window.electronAPI.pickFile(filters),
      pickDirectory: () => window.electronAPI.pickDirectory(),
      showSaveDialog: (opts) => window.electronAPI.showSaveDialog(opts),
      writeTextFile: (filePath, content) => window.electronAPI.writeTextFile(filePath, content),
      readTextFile: (filePath) => window.electronAPI.readTextFile(filePath),
      importShard: (filePath) => window.electronAPI.importShard(filePath),
      queryShardStatus: (shardId) => window.electronAPI.queryShardStatus(shardId),
      getInstanceDiskUsage: (instance) => window.electronAPI.getInstanceDiskUsage(instance),
      deleteOrphanedInstances: () => window.electronAPI.deleteOrphanedInstances(),
      hideWorkflowInstance: (instance) => window.electronAPI.hideWorkflowInstance(instance),
      unhideWorkflowInstance: (instance) => window.electronAPI.unhideWorkflowInstance(instance),
      listHiddenInstances: () => window.electronAPI.listHiddenInstances(),
      exportCatalogue: (name, path) => window.electronAPI.exportCatalogue(name, path),
      createCatalogueFromFile: (filePath) => window.electronAPI.createCatalogueFromFile(filePath),
      getTheme: () => window.electronAPI.getTheme()
    }
  : null;

const httpDispatch = async (endpoint, method = 'GET', body = null) => {
  const options = { method, headers: {} };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(endpoint, options);
  if (!res.ok) throw new Error(`HTTP error at ${endpoint}, status: ${res.status}`);
  const js = res.json();
  return js;
};

const httpAPI = {
  init: async () => httpDispatch('/api/init', 'POST', {}),
  createWorkflowInstance: async (workflow_id, version) =>
    httpDispatch('/api/create-workflow-instance', 'POST', { workflow_id, version }),
  runWorkflow: async (instance, params, opts) =>
    httpDispatch('/api/run-workflow', 'POST', { instance, params, opts }),
  listWorkflowInstances: async () => httpDispatch('/api/list-workflow-instances', 'POST', {}),
  getWorkflowInstanceLogs: async (instance, logType) =>
    httpDispatch('/api/get-workflow-instance-logs', 'POST', { instance, logType }),
  getInstanceProgress: async (instance) =>
    httpDispatch('/api/get-instance-progress', 'POST', { instance }),
  getWorkflowInstanceParams: async (instance) =>
    httpDispatch('/api/get-workflow-instance-params', 'POST', { instance }),
  cancelWorkflowInstance: async (instance) =>
    httpDispatch('/api/cancel-workflow-instance', 'POST', { instance }),
  resetWorkflowInstanceStatus: async (instance) =>
    httpDispatch('/api/reset-workflow-instance-status', 'POST', { instance }),
  killWorkflowInstance: async (instance) =>
    httpDispatch('/api/kill-workflow-instance', 'POST', { instance }),
  deleteWorkflowInstance: async (instance) =>
    httpDispatch('/api/delete-workflow-instance', 'POST', { instance }),
  deleteInstanceOutput: async (instance) =>
    httpDispatch('/api/delete-instance-output', 'POST', { instance }),
  openResultsFolder: async (instance) =>
    httpDispatch('/api/open-results-folder', 'POST', { instance }),
  openLogFile: async (instance, logType) =>
    httpDispatch('/api/open-log-file', 'POST', { instance, logType }),
  openWorkLogFile: async (instance, workID, logType) =>
    httpDispatch('/api/open-work-log-file', 'POST', { instance, workID, logType }),
  updateWorkflowInstanceStatus: async (instance) =>
    httpDispatch('/api/update-workflow-instance-status', 'POST', { instance }),
  getInstanceReportsList: async (instance) =>
    httpDispatch('/api/get-instance-reports-list', 'POST', { instance }),
  getPathReportsList: async (reportsPath) =>
    httpDispatch('/api/get-path-reports-list', 'POST', { reportsPath }),
  getOutputPathForInstance: async (instance) =>
    httpDispatch('/api/get-output-path-for-instance', 'POST', { instance }),
  getInstanceReport: async (instance, reportFile) =>
    httpDispatch('/api/get-instance-report', 'POST', { instance, reportFile }),
  openWorkFolder: async (instance, workID) =>
    httpDispatch('/api/open-work-folder', 'POST', { instance, workID }),
  getWorkLog: async (instance, workID, logType) =>
    httpDispatch('/api/get-work-log', 'POST', { instance, workID, logType }),
  getAvailableProfiles: async (instance) =>
    httpDispatch('/api/get-available-profiles', 'POST', { instance }),
  cloneRepo: async (repoUrl, ver, sourceVer) =>
    httpDispatch('/api/clone-repo', 'POST', { repoUrl, ver, sourceVer }),
  getRepoTags: async (repoUrl) => httpDispatch('/api/get-repo-tags', 'POST', { repoUrl }),
  isRepoInstalled: async (repoUrl, ver) =>
    httpDispatch('/api/is-repo-installed', 'POST', { repoUrl, ver }),
  isValidWorkflowRepo: async (repoPath) =>
    httpDispatch('/api/is-valid-workflow-repo', 'POST', { repoPath }),
  syncRepo: async (repo) => httpDispatch('/api/sync-repo', 'POST', { repo }),
  addCatalogue: async (repoUrl, ver) =>
    httpDispatch('/api/add-catalogue', 'POST', { repoUrl, ver }),
  removeCatalogue: async (catalogue_name) =>
    httpDispatch('/api/remove-catalogue', 'POST', { catalogue_name }),
  removeCatalogueSection: async (catalogue_name, section_name) =>
    httpDispatch('/api/remove-catalogue-section', 'POST', { catalogue_name, section_name }),
  hideCatalogueWorkflow: async (catalogue_name, section_name, workflow_name) =>
    httpDispatch('/api/hide-catalogue-workflow', 'POST', {
      catalogue_name,
      section_name,
      workflow_name
    }),
  hideCatalogueSection: async (catalogue_name, section_name) =>
    httpDispatch('/api/hide-catalogue-section', 'POST', { catalogue_name, section_name }),
  removeCatalogueWorkflow: async (catalogue_name, section_name, workflow_name) =>
    httpDispatch('/api/remove-catalogue-workflow', 'POST', {
      catalogue_name,
      section_name,
      workflow_name
    }),
  moveCatalogueWorkflowsToUser: async (catalogue_name, workflows) =>
    httpDispatch('/api/move-catalogue-workflows-to-user', 'POST', { catalogue_name, workflows }),
  uninstallCatalogueWorkflow: async (
    catalogue_name,
    section_name,
    workflow_name,
    workflow_version
  ) =>
    httpDispatch('/api/uninstall-catalogue-workflow', 'POST', {
      catalogue_name,
      section_name,
      workflow_name,
      workflow_version
    }),
  updateCatalogueWorkflow: async (catalogue_name, section_name, workflow_name) =>
    httpDispatch('/api/update-catalogue-workflow', 'POST', {
      catalogue_name,
      section_name,
      workflow_name
    }),
  checkCatalogueWorkflowUpdates: async (catalogue_name) =>
    httpDispatch('/api/check-catalogue-workflow-updates', 'POST', { catalogue_name }),
  checkWorkflowUpdates: async () => httpDispatch('/api/check-workflow-updates', 'POST', {}),
  showCatalogueSectionWorkflows: async (catalogue_name, section_name) =>
    httpDispatch('/api/show-catalogue-section-workflows', 'POST', { catalogue_name, section_name }),
  showCatalogueWorkflows: async (catalogue_name) =>
    httpDispatch('/api/show-catalogue-workflows', 'POST', { catalogue_name }),
  showCatalogueSections: async (catalogue_name) =>
    httpDispatch('/api/show-catalogue-sections', 'POST', { catalogue_name }),
  getCatalogues: async () => httpDispatch('/api/get-catalogues', 'POST', {}),
  getCatalogueParseResults: async () =>
    httpDispatch('/api/get-catalogue-parse-results', 'POST', {}),
  refreshCatalogues: async () => httpDispatch('/api/refresh-catalogues', 'POST', {}),
  addUserWorkflow: async (name, repoUrl, ver, section) =>
    httpDispatch('/api/add-user-workflow', 'POST', { name, repoUrl, ver, section }),
  getCollectionRepos: async () => httpDispatch('/api/get-collection-repos', 'POST', {}),
  getCollectionsPath: async () => httpDispatch('/api/get-collections-path', 'POST', {}),
  setCollectionsPath: async (path) => httpDispatch('/api/set-collections-path', 'POST', { path }),
  getConfigPath: async () => httpDispatch('/api/get-config-path', 'POST', {}),
  setConfigPath: async (path) => httpDispatch('/api/set-config-path', 'POST', { path }),
  getDocumentsPath: async () => httpDispatch('/api/get-documents-path', 'POST', {}),
  setDocumentsPath: async (path) => httpDispatch('/api/set-documents-path', 'POST', { path }),
  getOutputPath: async () => httpDispatch('/api/get-output-path', 'POST', {}),
  setOutputPath: async (path) => httpDispatch('/api/set-output-path', 'POST', { path }),
  getStoreDirPath: async () => httpDispatch('/api/get-store-dir-path', 'POST', {}),
  setStoreDirPath: async (path) => httpDispatch('/api/set-store-dir-path', 'POST', { path }),
  getDefaultPaths: async () => httpDispatch('/api/get-default-paths', 'POST', {}),
  getMissingPaths: async () => httpDispatch('/api/get-missing-paths', 'POST', {}),
  getContainerLogs: async (containerId) =>
    httpDispatch('/api/get-container-logs', 'POST', { containerId }),
  stopContainer: async (containerId) =>
    httpDispatch('/api/stop-container', 'POST', { containerId }),
  deleteRepo: async (repoPath) => httpDispatch('/api/delete-repo', 'POST', { repoPath }),
  getWorkflowParams: async (repoPath) =>
    httpDispatch('/api/get-workflow-params', 'POST', { repoPath }),
  getWorkflowSchema: async (repoPath) =>
    httpDispatch('/api/get-workflow-schema', 'POST', { repoPath }),
  getInstallableReposList: async () => httpDispatch('/api/get-installable-repos-list', 'POST', {}),
  addInstallableRepo: async (repoUrl) =>
    httpDispatch('/api/add-installable-repo', 'POST', { repoUrl }),
  getWorkflowInformation: async (instance) =>
    httpDispatch('/api/get-workflow-information', 'POST', { instance }),
  getWorkflowReadme: async (instance) =>
    httpDispatch('/api/get-workflow-readme', 'POST', { instance }),
  getWorkflowLicense: async (instance) =>
    httpDispatch('/api/get-workflow-license', 'POST', { instance }),
  settingsGet: async (key) => httpDispatch('/api/settings-get', 'POST', { key }),
  settingsSet: async (key, value) => httpDispatch('/api/settings-set', 'POST', { key, value }),
  openWebPage: async (url) => httpDispatch('/api/open-web-page', 'POST', { url }),
  getEnvironmentStatus: async (key) => httpDispatch('/api/get-environment-status', 'POST', { key }),
  performEnvironmentAction: async (key, action) =>
    httpDispatch('/api/perform-environment-action', 'POST', { key, action }),
  getSystemResources: async () => httpDispatch('/api/get-system-resources', 'POST', {}),
  getInstalledWorkflowIds: async () => httpDispatch('/api/get-installed-workflow-ids', 'POST', {}),
  pickFile: async (filters) => {
    const { showFileBrowser } = await import('./showFileBrowser.js');
    return showFileBrowser({ mode: 'file', filters });
  },
  pickDirectory: async () => {
    const { showFileBrowser } = await import('./showFileBrowser.js');
    return showFileBrowser({ mode: 'directory' });
  },
  showSaveDialog: async (opts) => {
    const { showFileBrowser } = await import('./showFileBrowser.js');
    return showFileBrowser({
      mode: 'save',
      filters: opts?.filters,
      defaultFilename: opts?.defaultPath
    });
  },
  writeTextFile: async (filePath, content) =>
    httpDispatch('/api/write-text-file', 'POST', { filePath, content }),
  readTextFile: async (filePath) => httpDispatch('/api/read-text-file', 'POST', { filePath }),
  importShard: async (filePath) => httpDispatch('/api/import-shard', 'POST', { filePath }),
  queryShardStatus: async (shardId) => httpDispatch('/api/query-shard-status', 'POST', { shardId }),
  getInstanceDiskUsage: async (instance) =>
    httpDispatch('/api/get-instance-disk-usage', 'POST', { instance }),
  deleteOrphanedInstances: async () => httpDispatch('/api/delete-orphaned-instances', 'POST', {}),
  hideWorkflowInstance: async (instance) =>
    httpDispatch('/api/hide-workflow-instance', 'POST', { instance }),
  unhideWorkflowInstance: async (instance) =>
    httpDispatch('/api/unhide-workflow-instance', 'POST', { instance }),
  listHiddenInstances: async () => httpDispatch('/api/list-hidden-instances', 'POST', {}),
  exportCatalogue: async (name, path) =>
    httpDispatch('/api/export-catalogue', 'POST', { name, path }),
  createCatalogueFromFile: async (filePath) =>
    httpDispatch('/api/create-catalogue-from-file', 'POST', { filePath }),
  getTheme: async () => httpDispatch('/api/get-theme', 'POST', {})
};

export const API = isElectron ? electronAPI : httpAPI;
