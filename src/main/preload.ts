const { contextBridge, ipcRenderer } = require('electron'); // must be CommonJS for electron

contextBridge.exposeInMainWorld('electronAPI', {
  createWorkflowInstance: (workflow_id: string) =>
    ipcRenderer.invoke('create-workflow-instance', workflow_id),
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
  killWorkflowInstance: (instance: any) => ipcRenderer.invoke('kill-workflow-instance', instance),
  openResultsFolder: (instance: any) => ipcRenderer.invoke('open-results-folder', instance),
  updateWorkflowInstanceStatus: (instance: any) =>
    ipcRenderer.invoke('update-workflow-instance-status', instance),
  openWorkFolder: (instance: any, work_id: string) =>
    ipcRenderer.invoke('open-work-folder', instance, work_id),
  getWorkLog: (instance: any, workID: string, logType: string) =>
    ipcRenderer.invoke('get-work-log', instance, workID, logType),
  getAvailableProfiles: (instance: any) => ipcRenderer.invoke('get-available-profiles', instance),

  // Legacy calls
  buildAndRunContainer: (folderPath: string, imageName: string) =>
    ipcRenderer.invoke('build-and-run-container', folderPath, imageName),
  listContainers: () => ipcRenderer.invoke('list-containers'),
  clearStoppedContainers: () => ipcRenderer.invoke('clear-stopped-containers'),
  cloneRepo: (repoUrl: string) => ipcRenderer.invoke('clone-repo', repoUrl),
  getCollectionsPath: () => ipcRenderer.invoke('get-collections-path'),
  setCollectionsPath: (path: string) => ipcRenderer.invoke('set-collections-path', path),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  syncRepo: (repo: string) => ipcRenderer.invoke('sync-repo', repo),
  getWorkflowParams: (repoPath: string) => ipcRenderer.invoke('get-workflow-params', repoPath),
  pickFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('pick-file', { filters }),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  getWorkflowSchema: (repoPath: string) => ipcRenderer.invoke('get-workflow-schema', repoPath)
});
