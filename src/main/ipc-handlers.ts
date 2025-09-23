import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import { ipcMain } from 'electron';
import { Collection } from './collection.js';

const collection = Collection.getInstance();

export function registerIpcHandlers() {
  ipcMain.handle('create-workflow-instance', async (event, workflow_id: string) => {
    return collection.createWorkflowInstance(workflow_id);
  });

  ipcMain.handle('list-workflow-instances', async () => {
    return collection.listWorkflowInstances();
  });

  ipcMain.handle('get-workflow-instance-logs', async (event, instance: any, logType: string) => {
    return collection.getWorkflowInstanceLogs(instance, logType);
  });

  ipcMain.handle('get-instance-progress', async (event, instance: any) => {
    return collection.getInstanceProgress(instance);
  });

  ipcMain.handle('get-workflow-instance-params', async (event, instance: any) => {
    return collection.getWorkflowInstanceParams(instance);
  });

  // Legacy calls
  ipcMain.handle('build-and-run-container', async (event, folderPath, imageName) => {
    return collection.buildAndRunContainer(folderPath, imageName);
  });

  ipcMain.handle('list-containers', async () => {
    return collection.listContainers();
  });

  ipcMain.handle('clear-stopped-containers', async () => {
    return collection.clearStoppedContainers();
  });

  ipcMain.handle('clone-repo', async (event, repoUrl) => {
    return await collection.cloneRepo(repoUrl);
  });

  ipcMain.handle('get-collections-path', () => {
    return collection.getCollectionsPath();
  });

  ipcMain.handle('set-collections-path', (event, path) => {
    return collection.setCollectionsPath(path);
  });

  ipcMain.handle('get-collections', async () => {
    return collection.getWorkflowsList();
  });

  ipcMain.handle('run-workflow', async (event, instance, params) => {
    return collection.runWorkflow(instance, params);
  });

  ipcMain.handle('sync-repo', async (event, path: string) => {
    return collection.syncRepo(path);
  });

  ipcMain.handle('get-workflow-params', async (event, repoPath) => {
    return collection.getWorkflowParams(repoPath);
  });

  ipcMain.handle('get-workflow-schema', async (event, repoPath) => {
    return collection.getWorkflowSchema(repoPath);
  });
}
