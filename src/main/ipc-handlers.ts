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

  ipcMain.handle('cancel-workflow-instance', async (event, instance: any) => {
    return collection.cancelWorkflowInstance(instance);
  });

  ipcMain.handle('kill-workflow-instance', async (event, instance: any) => {
    return collection.killWorkflowInstance(instance);
  });

  ipcMain.handle('open-results-folder', async (event, instance: any) => {
    return collection.openResultsFolder(instance);
  });

  ipcMain.handle('update-workflow-instance-status', async (event, instance: any) => {
    return collection.updateWorkflowInstanceStatus(instance);
  });

  ipcMain.handle('open-work-folder', async (event, instance: any, work_id: string) => {
    return collection.openWorkFolder(instance, work_id);
  });

  ipcMain.handle('get-work-log', async (event, instance: any, workID: string, logType: string) => {
    return collection.getWorkLog(instance, workID, logType);
  });

  ipcMain.handle('get-available-profiles', async (event, instance: any) => {
    return collection.getAvailableProfiles(instance);
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

  ipcMain.handle('run-workflow', async (event, instance, params, opts) => {
    return collection.runWorkflow(instance, params, opts);
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
