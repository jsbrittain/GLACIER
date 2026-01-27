import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import { ipcMain } from 'electron';
import { Collection } from './collection.js';
import { StoreSchema } from './settings.js';
import { Result } from '../types/types.js';

const collection = Collection.getInstance();

async function call(fcn: any, ...args: any[]): Promise<Result<any>> {
  try {
    const data = await fcn(...args);
    return { ok: true, data };
  } catch (err: any) {
    return {
      ok: false,
      error: { message: err?.message ?? 'Unknown error' }
    };
  }
}

export function registerIpcHandlers() {

  const redirect = {
    'run-workflow': collection.runWorkflow.bind(collection),
    'get-catalogues': collection.getCatalogues.bind(collection),
    'clone-repo': collection.cloneRepo.bind(collection),
    'is-repo-installed': collection.isRepoInstalled.bind(collection),
  };

  for (const [channel, fcn] of Object.entries(redirect)) {
    ipcMain.handle(channel, async (event, ...args) => {
      return call(fcn, ...args);
    });
  }

  /*
   * Legacy call format - update to use call() for consistent error handling
   */

  ipcMain.handle(
    'create-workflow-instance',
    async (event, workflow_id: string, version: string) => {
      return collection.createWorkflowInstance(workflow_id, version);
    }
  );

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

  ipcMain.handle('delete-workflow-instance', async (event, instance: any) => {
    return collection.deleteWorkflowInstance(instance);
  });

  ipcMain.handle('open-results-folder', async (event, instance: any) => {
    return collection.openResultsFolder(instance);
  });

  ipcMain.handle('update-workflow-instance-status', async (event, instance: any) => {
    return collection.updateWorkflowInstanceStatus(instance);
  });

  ipcMain.handle('get-instance-reports-list', async (event, instance: any) => {
    return collection.getInstanceReportsList(instance);
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

  ipcMain.handle('get-collections-path', () => {
    return collection.getCollectionsPath();
  });

  ipcMain.handle('set-collections-path', (event, path) => {
    return collection.setCollectionsPath(path);
  });

  ipcMain.handle('get-collection-repos', async () => {
    return collection.getCollectionRepos();
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

  ipcMain.handle('get-installable-repos-list', async (event) => {
    return collection.getInstallableReposList();
  });

  ipcMain.handle('add-installable-repo', async (event, repoUrl) => {
    return collection.addInstallableRepo(repoUrl);
  });

  ipcMain.handle('get-workflow-information', async (event, instance) => {
    return collection.getWorkflowInformation(instance);
  });

  ipcMain.handle('get-workflow-readme', async (event, instance) => {
    return collection.getWorkflowReadme(instance);
  });

  ipcMain.handle('settings-get', async (event, key: keyof StoreSchema) => {
    return collection.settingsGet(key);
  });

  ipcMain.handle(
    'settings-set',
    async (event, key: keyof StoreSchema, value: StoreSchema[keyof StoreSchema]) => {
      return collection.settingsSet(key, value);
    }
  );

  ipcMain.handle('open-web-page', async (event, url: string) => {
    return collection.openWebPage(url);
  });

  ipcMain.handle('get-environment-status', async (event, key) => {
    return collection.getEnvironmentStatus(key);
  });

  ipcMain.handle('perform-environment-action', async (event, key, action) => {
    return collection.performEnvironmentAction(key, action);
  });
}
