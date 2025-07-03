const { contextBridge, ipcRenderer } = require('electron'); // must be CommonJS for electron

contextBridge.exposeInMainWorld('electronAPI', {
  buildAndRunContainer: (folderPath, imageName) =>
    ipcRenderer.invoke('build-and-run-container', folderPath, imageName),
  listContainers: () => ipcRenderer.invoke('list-containers'),
  clearStoppedContainers: () => ipcRenderer.invoke('clear-stopped-containers'),
  cloneRepo: (repoUrl, targetDir) => ipcRenderer.invoke('clone-repo', repoUrl),
  getCollectionsPath: () => ipcRenderer.invoke('get-collections-path'),
  setCollectionsPath: (path) => ipcRenderer.invoke('set-collections-path', path),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  runRepo: (repo) => ipcRenderer.invoke('run-repo', repo),
  syncRepo: (repo) => ipcRenderer.invoke('sync-repo', repo)
});
