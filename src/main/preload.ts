const { contextBridge, ipcRenderer } = require('electron'); // must be CommonJS for electron

contextBridge.exposeInMainWorld('electronAPI', {
  buildAndRunContainer: (folderPath: string, imageName: string) =>
    ipcRenderer.invoke('build-and-run-container', folderPath, imageName),
  listContainers: () => ipcRenderer.invoke('list-containers'),
  clearStoppedContainers: () => ipcRenderer.invoke('clear-stopped-containers'),
  cloneRepo: (repoUrl: string, targetDir: string) =>
    ipcRenderer.invoke('clone-repo', repoUrl, targetDir),
  getCollectionsPath: () => ipcRenderer.invoke('get-collections-path'),
  setCollectionsPath: (path: string) => ipcRenderer.invoke('set-collections-path', path),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  runRepo: (repo: any) => ipcRenderer.invoke('run-repo', repo),
  syncRepo: (repo: string) => ipcRenderer.invoke('sync-repo', repo),
  getWorkflowParams: (repoPath: string) => ipcRenderer.invoke('get-workflow-params', repoPath),
  pickFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('pick-file', { filters }),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  getWorkflowSchema: (repoPath: string) => ipcRenderer.invoke('get-workflow-schema', repoPath)
});
