const { contextBridge, ipcRenderer } = require('electron'); // must be CommonJS for electron

contextBridge.exposeInMainWorld('electronAPI', {
  buildAndRunContainer: (folderPath, imageName) =>
    ipcRenderer.invoke('build-and-run-container', folderPath, imageName),
  listContainers: () => ipcRenderer.invoke('list-containers'),
  clearStoppedContainers: () => ipcRenderer.invoke('clear-stopped-containers'),
  cloneRepo: (repoUrl, targetDir) => ipcRenderer.invoke('clone-repo', repoUrl, targetDir)
});
