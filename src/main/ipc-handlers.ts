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
    init: collection.init.bind(collection),
    'run-workflow': collection.runWorkflow.bind(collection),
    'get-catalogues': collection.getCatalogues.bind(collection),
    'refresh-catalogues': collection.refreshCatalogues.bind(collection),
    'add-catalogue': collection.addCatalogue.bind(collection),
    'remove-catalogue': collection.removeCatalogue.bind(collection),
    'remove-catalogue-section': collection.removeCatalogueSection.bind(collection),
    'hide-catalogue-workflow': collection.hideCatalogueWorkflow.bind(collection),
    'hide-catalogue-section': collection.hideCatalogueSection.bind(collection),
    'remove-catalogue-workflow': collection.removeCatalogueWorkflow.bind(collection),
    'update-catalogue-workflow': collection.updateCatalogueWorkflow.bind(collection),
    'show-catalogue-section-workflows': collection.showCatalogueSectionWorkflows.bind(collection),
    'show-catalogue-workflows': collection.showCatalogueWorkflows.bind(collection),
    'show-catalogue-sections': collection.showCatalogueSections.bind(collection),
    'check-catalogue-workflow-updates': collection.checkCatalogueWorkflowUpdates.bind(collection),
    'add-user-workflow': collection.addUserWorkflow.bind(collection),
    'clone-repo': collection.cloneRepo.bind(collection),
    'is-repo-installed': collection.isRepoInstalled.bind(collection),
    'is-valid-workflow-repo': collection.isValidWorkflowRepo.bind(collection),
    'get-system-resources': collection.getSystemResources.bind(collection),
    'get-workflow-readme': collection.getWorkflowReadme.bind(collection),
    'get-workflow-license': collection.getWorkflowLicense.bind(collection),
    'import-shard': collection.importShard.bind(collection),
    'query-shard-status': collection.queryShardStatus.bind(collection),
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

  ipcMain.handle('reset-workflow-instance-status', async (event, instance: any) => {
    return collection.resetWorkflowInstanceStatus(instance);
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

  ipcMain.handle('get-installable-repos-list', async () => {
    return collection.getInstallableReposList();
  });

  ipcMain.handle('add-installable-repo', async (event, repoUrl) => {
    return collection.addInstallableRepo(repoUrl);
  });

  ipcMain.handle('get-workflow-information', async (event, instance) => {
    return collection.getWorkflowInformation(instance);
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
