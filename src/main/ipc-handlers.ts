import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { Collection } from './collection.js';
import { StoreSchema } from './settings.js';
import { Result } from '../types/types.js';

const collection = Collection.getInstance();

export async function call(fcn: any, ...args: any[]): Promise<Result<any>> {
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

export function registerIpcHandlers(resourceRoot?: string) {
  const redirect = {
    init: resourceRoot ? () => collection.init(resourceRoot) : collection.init.bind(collection),
    'run-workflow': collection.runWorkflow.bind(collection),
    'get-catalogues': collection.getCatalogues.bind(collection),
    'get-catalogue-parse-results': collection.getCatalogueParseResults.bind(collection),
    'refresh-catalogues': collection.refreshCatalogues.bind(collection),
    'add-catalogue': collection.addCatalogue.bind(collection),
    'remove-catalogue': collection.removeCatalogue.bind(collection),
    'remove-catalogue-section': collection.removeCatalogueSection.bind(collection),
    'hide-catalogue-workflow': collection.hideCatalogueWorkflow.bind(collection),
    'hide-catalogue-section': collection.hideCatalogueSection.bind(collection),
    'remove-catalogue-workflow': collection.removeCatalogueWorkflow.bind(collection),
    'move-catalogue-workflows-to-user': collection.moveCatalogueWorkflowsToUser.bind(collection),
    'uninstall-catalogue-workflow': collection.uninstallCatalogueWorkflow.bind(collection),
    'update-catalogue-workflow': collection.updateCatalogueWorkflow.bind(collection),
    'show-catalogue-section-workflows': collection.showCatalogueSectionWorkflows.bind(collection),
    'show-catalogue-workflows': collection.showCatalogueWorkflows.bind(collection),
    'show-catalogue-sections': collection.showCatalogueSections.bind(collection),
    'check-catalogue-workflow-updates': collection.checkCatalogueWorkflowUpdates.bind(collection),
    'check-workflow-updates': collection.checkWorkflowUpdates.bind(collection),
    'add-user-workflow': collection.addUserWorkflow.bind(collection),
    'clone-repo': collection.cloneRepo.bind(collection),
    'get-repo-tags': collection.getRepoTags.bind(collection),
    'is-repo-installed': collection.isRepoInstalled.bind(collection),
    'is-valid-workflow-repo': collection.isValidWorkflowRepo.bind(collection),
    'get-system-resources': collection.getSystemResources.bind(collection),
    'get-installed-workflow-ids': collection.getInstalledWorkflowIds.bind(collection),
    'get-workflow-readme': collection.getWorkflowReadme.bind(collection),
    'get-workflow-license': collection.getWorkflowLicense.bind(collection),
    'import-shard': collection.importShard.bind(collection),
    'query-shard-status': collection.queryShardStatus.bind(collection),
    'export-catalogue': collection.exportCatalogue.bind(collection),
    'create-catalogue-from-file': collection.createCatalogueFromFile.bind(collection)
  };

  for (const [channel, fcn] of Object.entries(redirect)) {
    ipcMain.handle(channel, async (event, ...args) => {
      return call(fcn, ...args);
    });
  }

  ipcMain.handle(
    'create-workflow-instance',
    async (event, workflow_id: string, version: string) => {
      return call(collection.createWorkflowInstance.bind(collection), workflow_id, version);
    }
  );

  ipcMain.handle('list-workflow-instances', async () => {
    return call(collection.listWorkflowInstances.bind(collection));
  });

  ipcMain.handle('get-workflow-instance-logs', async (event, instance: any, logType: string) => {
    return call(collection.getWorkflowInstanceLogs.bind(collection), instance, logType);
  });

  ipcMain.handle('get-instance-progress', async (event, instance: any) => {
    return call(collection.getInstanceProgress.bind(collection), instance);
  });

  ipcMain.handle('get-workflow-instance-params', async (event, instance: any) => {
    return call(collection.getWorkflowInstanceParams.bind(collection), instance);
  });

  ipcMain.handle('cancel-workflow-instance', async (event, instance: any) => {
    return call(collection.cancelWorkflowInstance.bind(collection), instance);
  });

  ipcMain.handle('reset-workflow-instance-status', async (event, instance: any) => {
    return call(collection.resetWorkflowInstanceStatus.bind(collection), instance);
  });

  ipcMain.handle('kill-workflow-instance', async (event, instance: any) => {
    return call(collection.killWorkflowInstance.bind(collection), instance);
  });

  ipcMain.handle('delete-workflow-instance', async (event, instance: any) => {
    return call(collection.deleteWorkflowInstance.bind(collection), instance);
  });

  ipcMain.handle('delete-instance-output', async (event, instance: any) => {
    return call(collection.deleteInstanceOutput.bind(collection), instance);
  });

  ipcMain.handle('open-results-folder', async (event, instance: any) => {
    return call(collection.openResultsFolder.bind(collection), instance);
  });

  ipcMain.handle('get-instance-disk-usage', async (event, instance: any) => {
    return call(collection.getInstanceDiskUsage.bind(collection), instance);
  });

  ipcMain.handle('delete-orphaned-instances', async () => {
    return call(collection.deleteOrphanedInstances.bind(collection));
  });

  ipcMain.handle('hide-workflow-instance', async (event, instance: any) => {
    return call(collection.hideWorkflowInstance.bind(collection), instance);
  });

  ipcMain.handle('unhide-workflow-instance', async (event, instance: any) => {
    return call(collection.unhideWorkflowInstance.bind(collection), instance);
  });

  ipcMain.handle('list-hidden-instances', async () => {
    return call(collection.listHiddenInstances.bind(collection));
  });

  ipcMain.handle('update-workflow-instance-status', async (event, instance: any) => {
    return call(collection.updateWorkflowInstanceStatus.bind(collection), instance);
  });

  ipcMain.handle('get-instance-reports-list', async (event, instance: any) => {
    return call(collection.getInstanceReportsList.bind(collection), instance);
  });

  ipcMain.handle('get-path-reports-list', async (event, reportsPath: string) => {
    return call(collection.getPathReportsList.bind(collection), reportsPath);
  });

  ipcMain.handle('get-output-path-for-instance', async (event, instance: any) => {
    return call(collection.getOutputPathForInstance.bind(collection), instance);
  });

  ipcMain.handle('open-work-folder', async (event, instance: any, work_id: string) => {
    return call(collection.openWorkFolder.bind(collection), instance, work_id);
  });

  ipcMain.handle('open-log-file', async (event, instance: any, log_type: string) => {
    return call(collection.openLogFile.bind(collection), instance, log_type);
  });

  ipcMain.handle(
    'open-work-log-file',
    async (event, instance: any, workID: string, logType: string) => {
      return call(collection.openWorkLogFile.bind(collection), instance, workID, logType);
    }
  );

  ipcMain.handle('get-work-log', async (event, instance: any, workID: string, logType: string) => {
    return call(collection.getWorkLog.bind(collection), instance, workID, logType);
  });

  ipcMain.handle('get-available-profiles', async (event, instance: any) => {
    return call(collection.getAvailableProfiles.bind(collection), instance);
  });

  ipcMain.handle('get-collections-path', () => {
    return call(collection.getCollectionsPath.bind(collection));
  });

  ipcMain.handle('set-collections-path', (event, path) => {
    return call(collection.setCollectionsPath.bind(collection), path);
  });

  ipcMain.handle('get-config-path', () => {
    return call(collection.getConfigPath.bind(collection));
  });

  ipcMain.handle('set-config-path', (event, path) => {
    return call(collection.setConfigPath.bind(collection), path);
  });

  ipcMain.handle('get-documents-path', () => {
    return call(collection.getDocumentsPath.bind(collection));
  });

  ipcMain.handle('set-documents-path', (event, path) => {
    return call(collection.setDocumentsPath.bind(collection), path);
  });

  ipcMain.handle('get-output-path', () => {
    return call(collection.getOutputPath.bind(collection));
  });

  ipcMain.handle('set-output-path', (event, path) => {
    return call(collection.setOutputPath.bind(collection), path);
  });

  ipcMain.handle('get-store-dir-path', () => {
    return call(collection.getStoreDirPath.bind(collection));
  });

  ipcMain.handle('set-store-dir-path', (event, path) => {
    return call(collection.setStoreDirPath.bind(collection), path);
  });

  ipcMain.handle('get-default-paths', () => {
    return call(collection.getDefaultPaths.bind(collection));
  });

  ipcMain.handle('get-missing-paths', () => {
    return call(collection.getMissingPaths.bind(collection));
  });

  ipcMain.handle('get-collection-repos', async () => {
    return call(collection.getCollectionRepos.bind(collection));
  });

  ipcMain.handle('sync-repo', async (event, path: string) => {
    return call(collection.syncRepo.bind(collection), path);
  });

  ipcMain.handle('get-workflow-params', async (event, repoPath) => {
    return call(collection.getWorkflowParams.bind(collection), repoPath);
  });

  ipcMain.handle('get-workflow-schema', async (event, repoPath) => {
    return call(collection.getWorkflowSchema.bind(collection), repoPath);
  });

  ipcMain.handle('get-installable-repos-list', async () => {
    return call(collection.getInstallableReposList.bind(collection));
  });

  ipcMain.handle('add-installable-repo', async (event, repoUrl) => {
    return call(collection.addInstallableRepo.bind(collection), repoUrl);
  });

  ipcMain.handle('get-workflow-information', async (event, instance) => {
    return call(collection.getWorkflowInformation.bind(collection), instance);
  });

  ipcMain.handle('settings-get', async (event, key: keyof StoreSchema) => {
    return call(collection.settingsGet.bind(collection), key);
  });

  ipcMain.handle(
    'settings-set',
    async (event, key: keyof StoreSchema, value: StoreSchema[keyof StoreSchema]) => {
      return call(collection.settingsSet.bind(collection), key, value);
    }
  );

  ipcMain.handle('open-web-page', async (event, url: string) => {
    return call(collection.openWebPage.bind(collection), url);
  });

  ipcMain.handle('get-environment-status', async (event, key) => {
    return call(collection.getEnvironmentStatus.bind(collection), key);
  });

  ipcMain.handle('perform-environment-action', async (event, key, action) => {
    return call(collection.performEnvironmentAction.bind(collection), key, action);
  });

  ipcMain.handle('get-theme', async () => {
    return call(() => {
      if (!resourceRoot) return null;
      const manifestPath = path.join(resourceRoot, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return null;
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      return manifest.theme || null;
    });
  });
}
