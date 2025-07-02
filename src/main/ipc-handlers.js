const { ipcMain } = require('electron');
const { buildAndRunContainer, listContainers, clearStoppedContainers } = require('./docker');
const { cloneRepo } = require('./repo');

module.exports = function registerIpcHandlers() {
  ipcMain.handle('build-and-run-container', async (event, folderPath, imageName) => {
    return buildAndRunContainer(folderPath, imageName);
  });

  ipcMain.handle('list-containers', async () => {
    return listContainers();
  });

  ipcMain.handle('clear-stopped-containers', async () => {
    return clearStoppedContainers();
  });

  ipcMain.handle('clone-repo', async (event, repoUrl, targetDir) => {
    return cloneRepo(repoUrl, targetDir);
  });
};
