import express from 'express';
import { Collection } from '../dist/main/collection.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const collection = Collection.getInstance();

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '../dist/renderer')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/renderer/index.html'));
});

const post_response = (res, maybe_promise) => {
  Promise.resolve(maybe_promise)
    .then((data) => res.json(data))
    .catch((err) => {
      console.error(err);
      return res.json({ ok: false, error: { message: err.message } });
    });
};

async function call(fcn, ...args) {
  try {
    const data = await fcn(...args);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: { message: err?.message ?? 'Unknown error' }
    };
  }
}

app.post('/api/init', async (req, res) =>
  post_response(res, call(collection.init.bind(collection), req.body.config))
);

app.post('/api/create-workflow-instance', async (req, res) =>
  post_response(res, call(collection.createWorkflowInstance.bind(collection), req.body.workflow_id, req.body.version))
);

app.post('/api/run-workflow', async (req, res) =>
  post_response(
    res,
    call(collection.runWorkflow.bind(collection), req.body.instance, req.body.params, req.body.opts)
  )
);

app.post('/api/list-workflow-instances', async (req, res) =>
  post_response(res, call(collection.listWorkflowInstances.bind(collection)))
);

app.post('/api/get-workflow-instance-logs', async (req, res) =>
  post_response(res, call(collection.getWorkflowInstanceLogs.bind(collection), req.body.instance, req.body.logType))
);

app.post('/api/get-instance-progress', async (req, res) =>
  post_response(res, call(collection.getInstanceProgress.bind(collection), req.body.instance))
);

app.post('/api/get-workflow-instance-params', async (req, res) =>
  post_response(res, call(collection.getWorkflowInstanceParams.bind(collection), req.body.instance))
);

app.post('/api/cancel-workflow-instance', async (req, res) =>
  post_response(res, call(collection.cancelWorkflowInstance.bind(collection), req.body.instance))
);

app.post('/api/reset-workflow-instance-status', async (req, res) =>
  post_response(res, call(collection.resetWorkflowInstanceStatus.bind(collection), req.body.instance))
);

app.post('/api/kill-workflow-instance', async (req, res) =>
  post_response(res, call(collection.killWorkflowInstance.bind(collection), req.body.instance))
);

app.post('/api/delete-workflow-instance', async (req, res) =>
  post_response(res, call(collection.deleteWorkflowInstance.bind(collection), req.body.instance))
);

app.post('/api/open-results-folder', async (req, res) =>
  post_response(res, call(collection.openResultsFolder.bind(collection), req.body.instance))
);

app.post('/api/update-workflow-instance-status', async (req, res) =>
  post_response(res, call(collection.updateWorkflowInstanceStatus.bind(collection), req.body.instance))
);

app.post('/api/open-work-folder', async (req, res) =>
  post_response(res, call(collection.openWorkFolder.bind(collection), req.body.instance, req.body.workID))
);

app.post('/api/get-work-log', async (req, res) =>
  post_response(res, call(collection.getWorkLog.bind(collection), req.body.instance, req.body.workID, req.body.logType))
);

app.post('/api/get-available-profiles', async (req, res) =>
  post_response(res, call(collection.getAvailableProfiles.bind(collection), req.body.instance))
);

app.post('/api/clone-repo', async (req, res) =>
  post_response(res, call(collection.cloneRepo.bind(collection), req.body.repoUrl, req.body.ver))
);

app.post('/api/is-repo-installed', async (req, res) =>
  post_response(
    res,
    call(collection.isRepoInstalled.bind(collection), req.body.repoUrl, req.body.ver)
  )
);

app.post('/api/is-valid-workflow-repo', async (req, res) =>
  post_response(res, call(collection.isValidWorkflowRepo.bind(collection), req.body.repoPath))
);

app.post('/api/sync-repo', async (req, res) =>
  post_response(res, call(collection.syncRepo.bind(collection), req.body.repo))
);

app.post('/api/add-catalogue', async (req, res) =>
  post_response(res, call(collection.addCatalogue.bind(collection), req.body.repoUrl, req.body.ver))
);

app.post('/api/remove-catalogue', async (req, res) =>
  post_response(res, call(collection.removeCatalogue.bind(collection), req.body.catalogue_name))
);

app.post('/api/remove-catalogue-section', async (req, res) =>
  post_response(
    res,
    call(collection.removeCatalogueSection.bind(collection), req.body.catalogue_name, req.body.section_name)
  )
);

app.post('/api/hide-catalogue-workflow', async (req, res) =>
  post_response(
    res,
    call(
      collection.hideCatalogueWorkflow.bind(collection),
      req.body.catalogue_name,
      req.body.section_name,
      req.body.workflow_name
    )
  )
);

app.post('/api/hide-catalogue-section', async (req, res) =>
  post_response(
    res,
    call(collection.hideCatalogueSection.bind(collection), req.body.catalogue_name, req.body.section_name)
  )
);

app.post('/api/remove-catalogue-workflow', async (req, res) =>
  post_response(
    res,
    call(
      collection.removeCatalogueWorkflow.bind(collection),
      req.body.catalogue_name,
      req.body.section_name,
      req.body.workflow_name
    )
  )
);

app.post('/api/update-catalogue-workflow', async (req, res) =>
  post_response(
    res,
    call(
      collection.updateCatalogueWorkflow.bind(collection),
      req.body.catalogue_name,
      req.body.section_name,
      req.body.workflow_name
    )
  )
);

app.post('/api/check-catalogue-workflow-updates', async (req, res) =>
  post_response(
    res,
    call(
      collection.checkCatalogueWorkflowUpdates.bind(collection),
      req.body.catalogue_name
    )
  )
);

app.post('/api/show-catalogue-section-workflows', async (req, res) =>
  post_response(
    res,
    call(collection.showCatalogueSectionWorkflows.bind(collection), req.body.catalogue_name, req.body.section_name)
  )
);

app.post('/api/show-catalogue-workflows', async (req, res) =>
  post_response(res, call(collection.showCatalogueWorkflows.bind(collection), req.body.catalogue_name))
);

app.post('/api/show-catalogue-sections', async (req, res) =>
  post_response(res, call(collection.showCatalogueSections.bind(collection), req.body.catalogue_name))
);

app.post('/api/get-catalogues', async (req, res) =>
  post_response(res, call(collection.getCatalogues.bind(collection)))
);

app.post('/api/refresh-catalogues', async (req, res) =>
  post_response(res, call(collection.refreshCatalogues.bind(collection)))
);

app.post('/api/add-user-workflow', async (req, res) =>
  post_response(
    res,
    call(
      collection.addUserWorkflow.bind(collection),
      req.body.name,
      req.body.repoUrl,
      req.body.ver,
      req.body.section
    )
  )
);

app.post('/api/get-collection-repos', async (req, res) =>
  post_response(res, call(collection.getCollectionRepos.bind(collection)))
);

app.post('/api/get-collections-path', async (req, res) =>
  post_response(res, call(collection.getCollectionsPath.bind(collection)))
);

app.post('/api/set-collections-path', async (req, res) =>
  post_response(res, call(collection.setCollectionsPath.bind(collection), req.body.path))
);

app.post('/api/get-config-path', async (req, res) =>
  post_response(res, call(collection.getConfigPath.bind(collection)))
);

app.post('/api/set-config-path', async (req, res) =>
  post_response(res, call(collection.setConfigPath.bind(collection), req.body.path))
);

app.post('/api/get-documents-path', async (req, res) =>
  post_response(res, call(collection.getDocumentsPath.bind(collection)))
);

app.post('/api/set-documents-path', async (req, res) =>
  post_response(res, call(collection.setDocumentsPath.bind(collection), req.body.path))
);

app.post('/api/get-missing-paths', async (req, res) =>
  post_response(res, call(collection.getMissingPaths.bind(collection)))
);

app.post('/api/pick-directory', async (req, res) => {
  const { dialog } = await import('electron');
  post_response(res, call(async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  }));
});

app.post('/api/get-container-logs', async (req, res) =>
  post_response(res, call(collection.getContainerLogs.bind(collection), req.body.containerId))
);

app.post('/api/stop-container', async (req, res) =>
  post_response(res, call(collection.stopContainer.bind(collection), req.body.containerId))
);

app.post('/api/delete-repo', async (req, res) =>
  post_response(res, call(collection.deleteRepo.bind(collection), req.body.repoPath))
);

app.post('/api/get-workflow-params', async (req, res) =>
  post_response(res, call(collection.getWorkflowParams.bind(collection), req.body.repoPath))
);

app.post('/api/get-workflow-schema', async (req, res) =>
  post_response(res, call(collection.getWorkflowSchema.bind(collection), req.body.repoPath))
);

app.post('/api/get-installable-repos-list', async (req, res) =>
  post_response(res, call(collection.getInstallableReposList.bind(collection)))
);

app.post('/api/add-installable-repo', async (req, res) =>
  post_response(res, call(collection.addInstallableRepo.bind(collection), req.body.repoUrl))
);

app.post('/api/get-workflow-readme', async (req, res) =>
  post_response(res, call(collection.getWorkflowReadme.bind(collection), req.body.instance))
);

app.post('/api/get-workflow-license', async (req, res) =>
  post_response(res, call(collection.getWorkflowLicense.bind(collection), req.body.instance))
);

app.post('/api/get-workflow-information', async (req, res) =>
  post_response(res, call(collection.getWorkflowInformation.bind(collection), req.body.instance))
);

app.post('/api/settings-get', async (req, res) =>
  post_response(res, call(collection.settingsGet.bind(collection), req.body.key))
);

app.post('/api/settings-set', async (req, res) =>
  post_response(res, call(collection.settingsSet.bind(collection), req.body.key, req.body.value))
);

app.post('/api/open-web-page', async (req, res) =>
  post_response(res, call(collection.openWebPage.bind(collection), req.body.url))
);

app.post('/api/get-environment-status', async (req, res) =>
  post_response(res, call(collection.getEnvironmentStatus.bind(collection), req.body.key))
);

app.post('/api/perform-environment-action', async (req, res) =>
  post_response(res, call(collection.performEnvironmentAction.bind(collection), req.body.key, req.body.action))
);

app.post('/api/get-system-resources', async (req, res) =>
  post_response(res, call(collection.getSystemResources.bind(collection)))
);

app.post('/api/file-pick', async (req, res) =>
  post_response(res, call(collection.filePick.bind(collection), req.body.filters))
);

app.post('/api/show-save-dialog', async (req, res) => {
  const { dialog } = await import('electron');
  post_response(res, call(async () => {
    const result = await dialog.showSaveDialog(req.body.opts);
    return result.canceled ? null : result.filePath;
  }));
});

app.post('/api/write-text-file', async (req, res) => {
  const fs = await import('fs');
  post_response(res, call(async () => {
    fs.writeFileSync(req.body.filePath, req.body.content, 'utf-8');
  }));
});

app.post('/api/read-text-file', async (req, res) => {
  const fs = await import('fs');
  post_response(res, call(async () => {
    return fs.readFileSync(req.body.filePath, 'utf-8');
  }));
});

app.post('/api/import-shard', async (req, res) =>
  post_response(res, call(collection.importShard.bind(collection), req.body.filePath))
);

app.post('/api/query-shard-status', async (req, res) =>
  post_response(res, call(collection.queryShardStatus.bind(collection), req.body.shardId))
);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`✅ API server listening on http://localhost:${PORT}`);
});
