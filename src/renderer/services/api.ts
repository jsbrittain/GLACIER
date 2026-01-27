const isElectron = Boolean(window?.electronAPI);

const electronAPI = isElectron
  ? {
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
      killWorkflowInstance: (instance) => window.electronAPI.killWorkflowInstance(instance),
      deleteWorkflowInstance: (instance) => window.electronAPI.deleteWorkflowInstance(instance),
      openResultsFolder: (instance) => window.electronAPI.openResultsFolder(instance),
      updateWorkflowInstanceStatus: (instance) =>
        window.electronAPI.updateWorkflowInstanceStatus(instance),
      getInstanceReportsList: (instance) => window.electronAPI.getInstanceReportsList(instance),
      getInstanceReport: (instance, reportFile) =>
        window.electronAPI.getInstanceReport(instance, reportFile),
      openWorkFolder: (instance, workID) => window.electronAPI.openWorkFolder(instance, workID),
      getWorkLog: (instance, workID, logType) =>
        window.electronAPI.getWorkLog(instance, workID, logType),
      getAvailableProfiles: (instance) => window.electronAPI.getAvailableProfiles(instance),

      cloneRepo: (repoUrl, ver) => window.electronAPI.cloneRepo(repoUrl, ver),
      isRepoInstalled: (repoUrl, ver) => window.electronAPI.isRepoInstalled(repoUrl, ver),
      syncRepo: (repo) => window.electronAPI.syncRepo(repo),
      getCatalogues: () => window.electronAPI.getCatalogues(),
      getCollectionRepos: () => window.electronAPI.getCollectionRepos(),
      getCollectionsPath: () => window.electronAPI.getCollectionsPath(),
      setCollectionsPath: (path) => window.electronAPI.setCollectionsPath(path),
      getContainerLogs: (containerId) => window.electronAPI.getContainerLogs(containerId),
      stopContainer: (containerId) => window.electronAPI.stopContainer(containerId),
      deleteRepo: (repoPath) => window.electronAPI.deleteRepo(repoPath),
      getWorkflowParams: (repoPath) => window.electronAPI.getWorkflowParams(repoPath),
      getWorkflowSchema: (repoPath) => window.electronAPI.getWorkflowSchema(repoPath),
      getInstallableReposList: () => window.electronAPI.getInstallableReposList(),
      addInstallableRepo: (repoUrl) => window.electronAPI.addInstallableRepo(repoUrl),
      getWorkflowInformation: (instance) => window.electronAPI.getWorkflowInformation(instance),
      getWorkflowReadme: (instance) => window.electronAPI.getWorkflowReadme(instance),
      settingsGet: (key) => window.electronAPI.settingsGet(key),
      settingsSet: (key, value) => window.electronAPI.settingsSet(key, value),
      openWebPage: (url) => window.electronAPI.openWebPage(url),
      getEnvironmentStatus: (key) => window.electronAPI.getEnvironmentStatus(key),
      performEnvironmentAction: (key, action) =>
        window.electronAPI.performEnvironmentAction(key, action)
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
  return res.json();
};

const httpAPI = {
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
  killWorkflowInstance: async (instance) =>
    httpDispatch('/api/kill-workflow-instance', 'POST', { instance }),
  deleteWorkflowInstance: async (instance) =>
    httpDispatch('/api/delete-workflow-instance', 'POST', { instance }),
  openResultsFolder: async (instance) =>
    httpDispatch('/api/open-results-folder', 'POST', { instance }),
  updateWorkflowInstanceStatus: async (instance) =>
    httpDispatch('/api/update-workflow-instance-status', 'POST', { instance }),
  getInstanceReportsList: async (instance) =>
    httpDispatch('/api/get-instance-reports-list', 'POST', { instance }),
  getInstanceReport: async (instance, reportFile) =>
    httpDispatch('/api/get-instance-report', 'POST', { instance, reportFile }),
  openWorkFolder: async (instance, workID) =>
    httpDispatch('/api/open-work-folder', 'POST', { instance, workID }),
  getWorkLog: async (instance, workID, logType) =>
    httpDispatch('/api/get-work-log', 'POST', { instance, workID, logType }),
  getAvailableProfiles: async (instance) =>
    httpDispatch('/api/get-available-profiles', 'POST', { instance }),
  cloneRepo: async (repoUrl, ver) => httpDispatch('/api/clone-repo', 'POST', { repoUrl, ver }),
  isRepoInstalled: async (repoUrl, ver) => httpDispatch('/api/is-repo-installed', 'POST', { repoUrl, ver }),
  syncRepo: async (repo) => httpDispatch('/api/sync-repo', 'POST', { repo }),
  getCollectionRepos: async () => httpDispatch('/api/get-collection-repos', 'POST', {}),
  getCollectionsPath: async () => httpDispatch('/api/get-collections-path', 'POST', {}),
  setCollectionsPath: async (path) => httpDispatch('/api/set-collections-path', 'POST', { path }),
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
  settingsGet: async (key) => httpDispatch('/api/settings-get', 'POST', { key }),
  settingsSet: async (key, value) => httpDispatch('/api/settings-set', 'POST', { key, value }),
  openWebPage: async (url) => httpDispatch('/api/open-web-page', 'POST', { url }),
  getEnvironmentStatus: async (key) => httpDispatch('/api/get-environment-status', 'POST', { key }),
  performEnvironmentAction: async (key, action) =>
    httpDispatch('/api/perform-environment-action', 'POST', { key, action })
};

export const API = isElectron ? electronAPI : httpAPI;
