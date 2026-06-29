import express from 'express';
import { Collection } from '../dist/main/collection.js';

import path from 'path';
import fs from 'fs';
import os from 'os';
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

app.post('/api/fs-home', async (req, res) => {
  res.json({ ok: true, data: os.homedir() });
});

app.post('/api/fs-list', async (req, res) => {
  const { path: reqPath, offset = 0, limit = 100, showHidden = false } = req.body;
  const resolvedPath = reqPath ? reqPath.replace(/^~/, os.homedir()) : os.homedir();
  const targetPath = path.resolve(resolvedPath);

  try {
    if (!fs.existsSync(targetPath)) {
      return res.json({ ok: false, error: { message: `Path does not exist: ${targetPath}` } });
    }
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return res.json({ ok: false, error: { message: `Not a directory: ${targetPath}` } });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const fileEntries = entries
      .filter((entry) => showHidden || !entry.name.startsWith('.'))
      .map((entry) => {
        try {
          const entryStat = fs.statSync(path.join(targetPath, entry.name));
          return {
            name: entry.name,
            path: path.join(targetPath, entry.name),
            isDirectory: entry.isDirectory(),
            size: entry.isDirectory() ? 0 : entryStat.size,
            modifiedAt: entryStat.mtime.toISOString()
          };
        } catch {
          return {
            name: entry.name,
            path: path.join(targetPath, entry.name),
            isDirectory: entry.isDirectory(),
            size: 0,
            modifiedAt: ''
          };
        }
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const total = fileEntries.length;
    const paginated = fileEntries.slice(offset, offset + limit);
    const parent = path.dirname(targetPath) === targetPath ? null : path.dirname(targetPath);

    return res.json({
      ok: true,
      data: {
        current: targetPath,
        parent,
        entries: paginated,
        total,
        offset,
        limit
      }
    });
  } catch (err) {
    return res.json({ ok: false, error: { message: err.message } });
  }
});

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

app.post('/api/get-instance-disk-usage', async (req, res) =>
  post_response(res, call(collection.getInstanceDiskUsage.bind(collection), req.body.instance))
);

app.post('/api/delete-orphaned-instances', async (req, res) =>
  post_response(res, call(collection.deleteOrphanedInstances.bind(collection)))
);

app.post('/api/hide-workflow-instance', async (req, res) =>
  post_response(res, call(collection.hideWorkflowInstance.bind(collection), req.body.instance))
);

app.post('/api/unhide-workflow-instance', async (req, res) =>
  post_response(res, call(collection.unhideWorkflowInstance.bind(collection), req.body.instance))
);

app.post('/api/list-hidden-instances', async (req, res) =>
  post_response(res, call(collection.listHiddenInstances.bind(collection)))
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
  post_response(res, call(collection.cloneRepo.bind(collection), req.body.repoUrl, req.body.ver, req.body.sourceVer))
);

app.post('/api/get-repo-tags', async (req, res) =>
  post_response(res, call(collection.getRepoTags.bind(collection), req.body.repoUrl))
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

app.post('/api/uninstall-catalogue-workflow', async (req, res) =>
  post_response(
    res,
    call(
      collection.uninstallCatalogueWorkflow.bind(collection),
      req.body.catalogue_name,
      req.body.section_name,
      req.body.workflow_name,
      req.body.workflow_version
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

app.post('/api/get-catalogue-parse-results', async (req, res) =>
  post_response(res, call(collection.getCatalogueParseResults.bind(collection)))
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

app.post('/api/get-default-paths', async (req, res) =>
  post_response(res, call(collection.getDefaultPaths.bind(collection)))
);

app.post('/api/get-missing-paths', async (req, res) =>
  post_response(res, call(collection.getMissingPaths.bind(collection)))
);

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

app.post('/api/fs-mkdir', async (req, res) => {
  const { path: dirPath } = req.body;
  post_response(res, call(async () => {
    const fs = await import('fs');
    fs.mkdirSync(dirPath, { recursive: true });
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
