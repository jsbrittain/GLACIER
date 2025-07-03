import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import { ipcMain } from 'electron';
import { buildAndRunContainer, listContainers, clearStoppedContainers, runRepo } from './docker.js';
import { cloneRepo, syncRepo } from './repo.js';
import { getDefaultCollectionsDir, getCollectionsPath } from './paths.js';
import store from './store.js';

export function registerIpcHandlers() {
  ipcMain.handle('build-and-run-container', async (event, folderPath, imageName) => {
    return buildAndRunContainer(folderPath, imageName);
  });

  ipcMain.handle('list-containers', async () => {
    return listContainers();
  });

  ipcMain.handle('clear-stopped-containers', async () => {
    return clearStoppedContainers();
  });

  ipcMain.handle('clone-repo', async (event, repoUrl) => {
    const result = await cloneRepo(repoUrl);
    console.log('[IPC] returning from clone-repo:', result); // ✅ log here
    return result;
  });

  ipcMain.handle('get-collections-path', () => {
    return store.get('collectionsPath') || getDefaultCollectionsDir();
  });

  ipcMain.handle('set-collections-path', (event, path) => {
    store.set('collectionsPath', path);
  });

  ipcMain.handle('get-collections', async () => {
    return getCollectionsPath();
  });

  ipcMain.handle('run-repo', async (event, { name, path: repoPath }) => {
    return runRepo({ name, path: repoPath });
  });

  ipcMain.handle('sync-repo', async (event, { path: repoPath }) => {
    return syncRepo({ path: repoPath });
  });
}
