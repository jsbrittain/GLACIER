import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Typography,
  Box,
  Grid,
  Menu,
  MenuItem
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import EnvironmentStatus from './EnvironmentStatus';
import ActionMenu from './ActionMenu';
import ProgressDialog from './ProgressDialog';
import ConfirmInstallDialog from './ConfirmInstallDialog';
import VersionSelectDialog from './VersionSelectDialog';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { API } from '../../services/api.js';

const resolveHttpUrl = (path, source) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (source) {
    return `${source.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
  // Fallback
  return path;
};

const repoUrl = (repo) => {
  if (repo.startsWith('http://') || repo.startsWith('https://')) {
    return repo.replace(/\.git$/, '');
  }
  return `https://github.com/${repo}`;
};

function WorkflowCard({
  workflow,
  hideWorkflow,
  uninstallWorkflow,
  updateWorkflow,
  scheme,
  createWorkflowInstance,
  refresh,
  requestInstallWorkflows,
  logMessage,
  updateMap
}) {
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState(null);
  const [isRepoInstalled, setIsRepoInstalled] = useState(false);
  const [versionInstalled, setVersionInstalled] = useState('');
  const [versionSelectorOpen, setVersionSelectorOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const menuIsOpen = Boolean(anchorEl);

  workflow['id'] = workflow['repo'];
  workflow['version'] = workflow['version'] ?? 'latest';

  const checkRepoInstalled = () =>
    API.isRepoInstalled(workflow.repo, workflow.version).then((result) => {
      if (result.ok) {
        const installed_version = result.data;
        if (installed_version) {
          setVersionInstalled(installed_version);
          setIsRepoInstalled(true);
        } else {
          setVersionInstalled('');
          setIsRepoInstalled(false);
        }
      } else {
        setIsRepoInstalled(false);
      }
    });

  useEffect(() => {
    checkRepoInstalled();
  }, [refresh]);

  const cloneRepo = async () => {
    if (workflow.version === 'latest') {
      setTagsLoading(true);
      setVersionSelectorOpen(true);
      const result = await API.getRepoTags(workflow.repo);
      setTagsLoading(false);
      if (result.ok) {
        const tags = result.data || [];
        if (tags.length === 0) {
          setVersionSelectorOpen(false);
          logMessage(t('library.no-tags-installing-default', { name: workflow.name }), 'info');
          requestInstallWorkflows([{
            id: `${workflow.repo}@latest`,
            repo: workflow.repo,
            version: 'latest',
            sourceVersion: 'latest'
          }]);
        } else {
          setAvailableTags(tags);
        }
      } else {
        setAvailableTags([]);
      }
    } else {
      const workflows = [{
        id: `${workflow.repo}@${workflow.version}`,
        repo: workflow.repo,
        version: workflow.version
      }];
      requestInstallWorkflows(workflows);
    }
  };

  const handleVersionSelected = (version: string) => {
    setVersionSelectorOpen(false);
    const workflows = [{
      id: `${workflow.repo}@latest`,
      repo: workflow.repo,
      version: version,
      sourceVersion: 'latest'
    }];
    requestInstallWorkflows(workflows);
  };

  const handleVersionCancel = () => {
    setVersionSelectorOpen(false);
    setAvailableTags([]);
  };

  const runWorkflow = () => {
    createWorkflowInstance(workflow);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleHideWorkflow = async () => {
    hideWorkflow();
    handleMenuClose();
  };

  const handleUninstallWorkflow = async () => {
    uninstallWorkflow();
    handleMenuClose();
  };

  const checkForUpdates = async () => {
    const result = await updateWorkflow();
    if (result?.ok && result.data?.updated && result.data?.availableVersion) {
      const tagsResult = await API.getRepoTags(workflow.repo);
      if (tagsResult.ok) {
        setAvailableTags(tagsResult.data || []);
        setVersionSelectorOpen(true);
      }
    }
    handleMenuClose();
  };

  const selectVersion = async () => {
    setTagsLoading(true);
    setVersionSelectorOpen(true);
    const result = await API.getRepoTags(workflow.repo);
    setTagsLoading(false);
    if (result.ok) {
      const tags = result.data || [];
      if (tags.length === 0) {
        setVersionSelectorOpen(false);
        logMessage(t('library.no-tags-installing-default', { name: workflow.name }), 'info');
      } else {
        setAvailableTags(tags);
      }
    } else {
      setVersionSelectorOpen(false);
    }
    handleMenuClose();
  };

  const handleSourceClick = (e) => {
    e.stopPropagation();
    API.openWebPage(repoUrl(workflow.repo));
  };

  return (
    <Paper
      id={`card-${workflow.name}`}
      variant="outlined"
      onClick={isRepoInstalled ? () => {
        if (menuIsOpen || versionSelectorOpen) return;
        runWorkflow();
      } : undefined}
      sx={{
        p: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: isRepoInstalled ? 'pointer' : 'default',
        color: scheme['workflow-fg'] ?? 'text.primary',
        background: scheme['workflow-bg'] ?? 'background.paper',
        fontFamily: scheme['font-family'] ?? 'inherit',
        fontSize: scheme['font-size'] ?? 'inherit',
        filter: !isRepoInstalled ? 'grayscale(60%)' : 'none',
        transition: 'filter 0.2s, background-color 0.2s',
        '&:hover': isRepoInstalled
          ? { backgroundColor: 'action.hover' }
          : {}
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 0
        }}
      >
        <Typography variant="h6">{workflow.name}</Typography>
        <Box sx={{ ml: 'auto' }}>
          <IconButton color="inherit" onClick={(e) => { e.stopPropagation(); handleMenuOpen(e); }}>
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
          <MenuItem onClick={handleHideWorkflow}>{t('library.hide-repository')}</MenuItem>
          {isRepoInstalled && (
            <MenuItem onClick={handleUninstallWorkflow}>{t('library.uninstall-repository')}</MenuItem>
          )}
          {workflow['version'] === 'latest' && isRepoInstalled && (
            <MenuItem onClick={selectVersion}>{t('library.select-version')}</MenuItem>
          )}
          {workflow['version'] === 'latest' && isRepoInstalled && (
            <MenuItem onClick={checkForUpdates}>{t('library.check-for-updates')}</MenuItem>
          )}
        </Menu>
      </Box>
      <Typography variant="subtitle1">
        {workflow.version}{' '}
        {isRepoInstalled && workflow.version === 'latest' && `(${versionInstalled})`}
      </Typography>
      {isRepoInstalled && workflow.version === 'latest' && updateMap?.[workflow.repo] && (
        <Typography variant="caption" color="warning.main">
          {t('library.update-available', { version: updateMap[workflow.repo].availableVersion })}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {!isRepoInstalled && (
        <Stack direction="row" spacing={1}>
          <Button
            id={`install-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['control-fg'] ?? undefined,
              background: scheme['control-bg'] ?? undefined,
              fontFamily: scheme['font-family'] ?? 'inherit',
              fontSize: scheme['font-size'] ?? 'inherit'
            }}
            onClick={(e) => { e.stopPropagation(); cloneRepo(); }}
          >
            {t('library.install')}
          </Button>
          <Button
            id={`source-${workflow.name}`}
            size="small"
            variant="outlined"
            onClick={handleSourceClick}
          >
            {t('library.source')}
          </Button>
        </Stack>
      )}
      <VersionSelectDialog
        open={versionSelectorOpen}
        workflowName={workflow.name}
        tags={availableTags}
        loading={tagsLoading}
        onConfirm={handleVersionSelected}
        onCancel={handleVersionCancel}
      />
    </Paper>
  );
}

function SectionCard({
  section,
  deleteSection,
  hideWorkflow,
  uninstallWorkflow,
  updateWorkflow,
  hideSection,
  showSectionWorkflows,
  scheme,
  source,
  createWorkflowInstance,
  permitCatalogueModifications,
  refresh,
  requestInstallWorkflows,
  logMessage,
  updateMap
}) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuIsOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const queueInstallWorkflows = async () => {
    let workflows = section?.workflows || [];
    requestInstallWorkflows(
      workflows.map((workflow) => ({
        id: `${workflow.repo}@${workflow.version}`,
        repo: workflow.repo,
        version: workflow.version
      }))
    );
    handleMenuClose();
  };

  const handleShowSectionWorkflows = async () => {
    showSectionWorkflows();
    handleMenuClose();
  };

  const handleDeleteSection = async () => {
    deleteSection();
    handleMenuClose();
  };

  return (
    <Paper
      elevation={2}
      sx={{
        color: section?.scheme?.['section-fg'] ?? scheme['section-fg'] ?? 'text.primary',
        background: section?.scheme?.['section-bg'] ?? scheme['section-bg'] ?? 'background.paper',
        fontFamily: section?.scheme?.['font-family'] ?? scheme['font-family'] ?? 'inherit',
        fontSize: section?.scheme?.['font-size'] ?? scheme['font-size'] ?? 'inherit'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 1,
          color:
            section?.scheme?.['section-title-fg'] ?? scheme['section-title-fg'] ?? 'text.primary',
          background:
            section?.scheme?.['section-title-bg'] ?? scheme['section-title-bg'] ?? 'transparent',
          fontFamily:
            section?.scheme?.['title-font-family'] ?? scheme['title-font-family'] ?? 'inherit',
          fontSize: section?.scheme?.['title-font-size'] ?? scheme['title-font-size'] ?? 'inherit'
        }}
      >
        {section?.icon && (
          <Box
            component="img"
            src={resolveHttpUrl(section?.icon, source)}
            sx={{
              ml: 1,
              borderRadius: 2,
              maxHeight: 60
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <Box>
          <Typography
            variant="h6"
            sx={{
              px: 1,
              py: 0.2
            }}
          >
            {section.name}
          </Typography>
          {section.description && (
            <Typography variant="subtitle1" sx={{ px: 1, py: 0.2 }}>
              {section.description}
            </Typography>
          )}
        </Box>
        {permitCatalogueModifications && (
          <>
            <Box sx={{ ml: 'auto' }}>
              <IconButton color="inherit" onClick={handleMenuOpen}>
                <MoreVertIcon />
              </IconButton>
            </Box>
            <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
              <MenuItem onClick={queueInstallWorkflows}>
                {t('library.install-all-workflows')}
              </MenuItem>
              <MenuItem
                onClick={handleShowSectionWorkflows}
                disabled={!(section?.workflows || []).some((workflow) => workflow?.hidden)}
              >
                {t('library.show-all-workflows')}
              </MenuItem>
              <MenuItem onClick={hideSection}>{t('library.hide-section')}</MenuItem>
              <MenuItem onClick={handleDeleteSection}>{t('library.remove-section')}</MenuItem>
            </Menu>
          </>
        )}
      </Box>
      <Grid container spacing={2} sx={{ px: 1, pb: 1 }}>
        {(section?.workflows || [])
          .filter((workflow) => !(workflow?.hidden || false))
          .map((workflow) => (
            <Grid size={3}>
              <WorkflowCard
                workflow={workflow}
                hideWorkflow={() => hideWorkflow(workflow)}
                uninstallWorkflow={() => uninstallWorkflow(workflow)}
                updateWorkflow={() => updateWorkflow(workflow)}
                scheme={scheme}
                createWorkflowInstance={createWorkflowInstance}
                refresh={refresh}
                requestInstallWorkflows={requestInstallWorkflows}
                logMessage={logMessage}
                updateMap={updateMap}
              />
            </Grid>
          ))}
      </Grid>
    </Paper>
  );
}

function CatalogueCard({
  catalogue,
  deleteCatalogue,
  deleteSection,
  hideWorkflow,
  uninstallWorkflow,
  updateWorkflow,
  hideSection,
  showSectionWorkflows,
  showSections,
  createWorkflowInstance,
  permitCatalogueModifications,
  refresh,
  requestInstallWorkflows,
  logMessage,
  getCatalogues,
  updateMap
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuIsOpen = Boolean(anchorEl);
  const updateQueueRef = useRef([]);
  const updateQueueIndexRef = useRef(0);
  const [versionSelectorOpen, setVersionSelectorOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [currentUpdateName, setCurrentUpdateName] = useState('');

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const queueInstallWorkflows = async () => {
    let workflows = [];
    for (const section of catalogue.sections || []) {
      for (const workflow of section.workflows || []) {
        workflows.push({
          id: `${workflow.repo}@${workflow.version}`,
          repo: workflow.repo,
          version: workflow.version
        });
      }
    }
    requestInstallWorkflows(workflows);
    handleMenuClose();
  };

  const handleDeleteCatalogue = async () => {
    deleteCatalogue();
    handleMenuClose();
  };

  const handleShowSections = async () => {
    showSections();
    handleMenuClose();
  };

  const showVersionPickerForUpdate = async (entry) => {
    setCurrentUpdateName(entry.name);
    setTagsLoading(true);
    setVersionSelectorOpen(true);
    const tagsResult = await API.getRepoTags(entry.repo);
    setTagsLoading(false);
    if (tagsResult.ok) {
      setAvailableTags(tagsResult.data || []);
    } else {
      setAvailableTags([]);
    }
  };

  const advanceUpdateQueue = async () => {
    const nextIndex = updateQueueIndexRef.current + 1;
    if (nextIndex < updateQueueRef.current.length) {
      updateQueueIndexRef.current = nextIndex;
      await showVersionPickerForUpdate(updateQueueRef.current[nextIndex]);
    } else {
      setVersionSelectorOpen(false);
      updateQueueRef.current = [];
      updateQueueIndexRef.current = 0;
    }
  };

  const handleUpdateVersionSelected = async (version: string) => {
    const entry = updateQueueRef.current[updateQueueIndexRef.current];
    setVersionSelectorOpen(false);
    requestInstallWorkflows([{
      id: `${entry.repo}@latest`,
      repo: entry.repo,
      version: version,
      sourceVersion: 'latest'
    }]);
    await advanceUpdateQueue();
  };

  const handleUpdateVersionCancel = async () => {
    await advanceUpdateQueue();
  };

  const checkForUpdates = async () => {
    logMessage(t('library.checking-for-updates-catalogue', { name: catalogue.name }), 'info');
    const result = await API.checkCatalogueWorkflowUpdates(catalogue.name);
    if (result.ok) {
      const { errors, updated, errorDetails, updates } = result.data;
      for (const detail of errorDetails || []) {
        logMessage(detail, 'error');
      }
      if (updated > 0) {
        updateQueueRef.current = updates || [];
        updateQueueIndexRef.current = 0;
        const entry = (updates || [])[0];
        if (entry) {
          await showVersionPickerForUpdate(entry);
        }
      } else if (errors > 0) {
        logMessage(
          t('library.catalogue-workflows-check-failure', { name: catalogue.name, error: `All ${errors} workflow(s) failed to sync` }),
          'error'
        );
      } else {
        logMessage(
          t('library.catalogue-workflows-up-to-date', { name: catalogue.name }),
          'success'
        );
      }
      getCatalogues();
    } else {
      logMessage(
        t('library.catalogue-workflows-check-failure', { name: catalogue.name, error: result.error?.message ?? 'Unknown error' }),
        'error'
      );
    }
    handleMenuClose();
  };

  const handleExport = async () => {
    const saveResult = await API.showSaveDialog({
      defaultPath: `${catalogue.name}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!saveResult.ok) {
      handleMenuClose();
      return;
    }
    const result = await API.exportCatalogue(catalogue.name, saveResult.data);
    if (result.ok) {
      logMessage(t('library.export-catalogue-success', { name: catalogue.name, path: saveResult.data }), 'success');
    } else {
      logMessage(t('library.export-catalogue-failure', { error: result.error.message }), 'error');
    }
    handleMenuClose();
  };

  return (
    <Paper
      sx={{
        p: 1,
        background: catalogue?.scheme?.['background'] ?? 'background.paper',
        color: catalogue?.scheme?.['foreground'] ?? 'text.primary',
        fontFamily: catalogue?.scheme?.['font-family'] ?? 'inherit',
        fontSize: catalogue?.scheme?.['font-size'] ?? 'inherit'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          mb: 1,
          borderRadius: 2,
          background: catalogue?.scheme?.['title-bg'] ?? theme.palette.primary.main,
          color: catalogue?.scheme?.['title-fg'] ?? theme.palette.primary.contrastText,
          fontFamily: catalogue?.scheme?.['title-font-family'] ?? 'inherit',
          fontSize: catalogue?.scheme?.['title-font-size'] ?? 'inherit'
        }}
      >
        {catalogue?.icon && (
          <Box
            component="img"
            src={`${catalogue?.['base_dir']}/${catalogue.icon}`} // `` syntax highlighting hack
            sx={{
              m: 0.5,
              maxHeight: 80
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <Box>
          <Typography variant="h5">{catalogue.name}</Typography>
          {catalogue.description && (
            <Typography variant="subtitle1">{catalogue.description}</Typography>
          )}
          {updateMap && (() => {
            const count = Object.keys(updateMap).filter((repo) =>
              (catalogue.sections || []).some((s) =>
                (s.workflows || []).some((w) => w.repo === repo)
              )
            ).length;
            return count > 0 ? (
              <Chip
                label={t('library.updates-available', { count })}
                color="warning"
                size="small"
                sx={{ ml: 1 }}
              />
            ) : null;
          })()}
        </Box>
        {permitCatalogueModifications && (
          <>
            <Box sx={{ ml: 'auto' }}>
              <IconButton color="inherit" onClick={handleMenuOpen}>
                <MoreVertIcon />
              </IconButton>
            </Box>
            <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
              <MenuItem onClick={queueInstallWorkflows}>
                {t('library.install-all-workflows')}
              </MenuItem>
              <MenuItem onClick={handleDeleteCatalogue}>{t('library.remove-catalogue')}</MenuItem>
              <MenuItem onClick={handleShowSections}>{t('library.show-all-workflows')}</MenuItem>
              <MenuItem onClick={handleExport}>{t('library.export-catalogue')}</MenuItem>
              {catalogue?.name !== 'User collection' && (
                <MenuItem onClick={checkForUpdates}>{t('library.check-for-updates')}</MenuItem>
              )}
            </Menu>
          </>
        )}
      </Box>
      <Stack spacing={1}>
        {(catalogue?.sections || [])
          .filter((section) => !(section?.hidden || false))
          .map((section) => (
            <SectionCard
              section={section}
              deleteSection={() => deleteSection(section)}
              hideWorkflow={(workflow) => hideWorkflow(section, workflow)}
              uninstallWorkflow={(workflow) => uninstallWorkflow(section, workflow)}
              updateWorkflow={(workflow) => updateWorkflow(section, workflow)}
              hideSection={() => hideSection(section)}
              showSectionWorkflows={() => showSectionWorkflows(section)}
              scheme={catalogue?.scheme || {}}
              source={catalogue?.['base_dir']}
              createWorkflowInstance={createWorkflowInstance}
              permitCatalogueModifications={permitCatalogueModifications}
              refresh={refresh}
              requestInstallWorkflows={requestInstallWorkflows}
              logMessage={logMessage}
              updateMap={updateMap}
            />
          ))}
      </Stack>
      <VersionSelectDialog
        open={versionSelectorOpen}
        workflowName={currentUpdateName}
        tags={availableTags}
        loading={tagsLoading}
        onConfirm={handleUpdateVersionSelected}
        onCancel={handleUpdateVersionCancel}
      />
    </Paper>
  );
}

export default function LibraryPage({
  createWorkflowInstance,
  permitAddCatalogues,
  permitCatalogueModifications,
  permitImportShards,
  permitAddRepos,
  navigateToSettingsEnv,
  logMessage
}) {
  const { t } = useTranslation();
  const [catalogues, setCatalogues] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [updateMap, setUpdateMap] = useState({});

  const [progressCount, setProgressCount] = useState(0);
  const [progressValue, setProgressValue] = useState(0);
  const [uninstallTarget, setUninstallTarget] = useState(null);
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [pendingInstallWorkflows, setPendingInstallWorkflows] = useState(null);

  const getCatalogues = async () => {
    API.getCatalogues().then((result) => {
      if (result.ok) {
        setCatalogues(result.data);
        // Non-blocking update check — never blocks catalogue rendering
        API.checkWorkflowUpdates().then((updateResult) => {
          if (updateResult.ok) {
            setUpdateMap(updateResult.data || {});
          }
        });
      }
    });
  };

  useEffect(() => {
    getCatalogues();
  }, []);

  const deleteCatalogue = async (catalogue) => {
    const installedResult = await API.getInstalledWorkflowIds();
    const installedRepos = new Set(installedResult.ok ? installedResult.data : []);

    const workflows = [];
    const seenKeys = new Set<string>();
    for (const section of catalogue.sections || []) {
      for (const wf of section.workflows || []) {
        if (!installedRepos.has(wf.repo)) continue;
        const key = `${wf.repo}@${wf.version || 'latest'}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        workflows.push({ section: section.name, name: wf.name, repo: wf.repo, version: wf.version, delete: true });
      }
    }

    const otherKeys = new Set<string>();
    for (const otherCat of catalogues || []) {
      if (otherCat.name === catalogue.name) continue;
      for (const sec of otherCat.sections || []) {
        for (const wf of sec.workflows || []) {
          otherKeys.add(`${wf.repo}@${wf.version || 'latest'}`);
        }
      }
    }

    const uniqueWorkflows = workflows.filter((wf) => !otherKeys.has(`${wf.repo}@${wf.version || 'latest'}`));

    if (uniqueWorkflows.length === 0 || catalogue.source === 'local') {
      if (!window.confirm(t('library.confirm-remove-catalogue', { name: catalogue.name }))) return;
      return doDeleteCatalogue(catalogue);
    }

    setDeleteDialog({ type: 'catalogue', catalogue, workflows: uniqueWorkflows });
  };

  const doDeleteCatalogue = async (catalogue) => {
    API.removeCatalogue(catalogue.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.catalogue-removed-success', { name: catalogue.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.catalogue-removed-failure', { name: catalogue.name }), 'error');
      }
    });
  };

  const hideSection = async (catalogue, section) => {
    if (!window.confirm(t('library.confirm-hide-section', { name: section.name }))) {
      return;
    }
    API.hideCatalogueSection(catalogue.name, section.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.section-hidden-success', { name: section.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.section-hidden-failure', { name: section.name }), 'error');
      }
    });
  };

  const deleteSection = async (catalogue, section) => {
    const installedResult = await API.getInstalledWorkflowIds();
    const installedRepos = new Set(installedResult.ok ? installedResult.data : []);

    const seenKeys = new Set<string>();
    const workflows = (section.workflows || [])
      .filter((wf) => {
        if (!installedRepos.has(wf.repo)) return false;
        const key = `${wf.repo}@${wf.version || 'latest'}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .map((wf) => ({
      section: section.name, name: wf.name, repo: wf.repo, version: wf.version, delete: true
    }));

    const otherKeys = new Set<string>();
    for (const otherCat of catalogues || []) {
      if (otherCat.name === catalogue.name) {
        for (const sec of otherCat.sections || []) {
          if (sec.name === section.name) continue;
          for (const wf of sec.workflows || []) {
            otherKeys.add(`${wf.repo}@${wf.version || 'latest'}`);
          }
        }
      } else {
        for (const sec of otherCat.sections || []) {
          for (const wf of sec.workflows || []) {
            otherKeys.add(`${wf.repo}@${wf.version || 'latest'}`);
          }
        }
      }
    }

    const uniqueWorkflows = workflows.filter((wf) => !otherKeys.has(`${wf.repo}@${wf.version || 'latest'}`));

    if (uniqueWorkflows.length === 0 || catalogue.source === 'local') {
      if (!window.confirm(t('library.confirm-remove-section', { name: section.name }))) return;
      return doDeleteSection(catalogue, section);
    }

    setDeleteDialog({ type: 'section', catalogue, section, workflows: uniqueWorkflows });
  };

  const doDeleteSection = async (catalogue, section) => {
    API.removeCatalogueSection(catalogue.name, section.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.section-removed-success', { name: section.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.section-removed-failure', { name: section.name }), 'error');
      }
    });
  };

  const hideWorkflow = (catalogue, section, workflow) => {
    if (!window.confirm(t('library.confirm-hide-workflow', { name: workflow.name }))) {
      return;
    }
    API.hideCatalogueWorkflow(catalogue.name, section.name, workflow.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.workflow-hidden-success', { name: workflow.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.workflow-hidden-failure', { name: workflow.name }), 'error');
      }
    });
  };

  const uninstallWorkflow = (catalogue, section, workflow) => {
    setUninstallTarget({ catalogue, section, workflow });
    setUninstallDialogOpen(true);
  };

  const toggleWorkflow = (index) => {
    if (!deleteDialog) return;
    const workflows = [...deleteDialog.workflows];
    workflows[index] = { ...workflows[index], delete: !workflows[index].delete };
    setDeleteDialog({ ...deleteDialog, workflows });
  };

  const setAllWorkflows = (deleteValue) => {
    if (!deleteDialog) return;
    const workflows = deleteDialog.workflows.map((wf) => ({ ...wf, delete: deleteValue }));
    setDeleteDialog({ ...deleteDialog, workflows });
  };

  const confirmDeleteDialog = async () => {
    if (!deleteDialog) return;
    const { type, catalogue, section, workflows } = deleteDialog;

    const toDelete = workflows.filter((wf) => wf.delete);
    for (const wf of toDelete) {
      const version = wf.version || 'latest';
      await API.uninstallCatalogueWorkflow(catalogue.name, wf.section, wf.name, version);
    }

    const toMigrate = workflows.filter((wf) => !wf.delete).map((wf) => ({
      section: wf.section, name: wf.name
    }));

    if (toMigrate.length > 0) {
      const result = await API.moveCatalogueWorkflowsToUser(catalogue.name, toMigrate);
      if (result.ok) {
        logMessage(t('library.workflows-moved-success', { count: result.data }), 'success');
      } else {
        logMessage(t('library.workflows-moved-failure'), 'error');
      }
    }

    if (type === 'catalogue') {
      await doDeleteCatalogue(catalogue);
    } else {
      await doDeleteSection(catalogue, section);
    }

    setDeleteDialog(null);
  };

  const confirmUninstall = async () => {
    if (!uninstallTarget) return;
    const { catalogue, section, workflow } = uninstallTarget;
    workflow['version'] = workflow['version'] ?? 'latest';
    const result = await API.uninstallCatalogueWorkflow(
      catalogue.name, section.name, workflow.name, workflow.version
    );
    if (result.ok) {
      logMessage(t('library.workflow-uninstalled-success', { name: workflow.name }), 'success');
      setRefresh(!refresh);
    } else {
      logMessage(t('library.workflow-uninstalled-failure', { name: workflow.name }), 'error');
    }
    setUninstallDialogOpen(false);
    setUninstallTarget(null);
  };

  const updateWorkflow = (catalogue, section, workflow) => {
    logMessage(t('library.checking-for-updates', { name: workflow.name }), 'info');
    return API.updateCatalogueWorkflow(catalogue.name, section.name, workflow.name).then((result) => {
      if (result.ok) {
        if (result.data?.updated) {
          logMessage(t('library.workflow-updated-success', { name: workflow.name }), 'success');
        } else {
          logMessage(t('library.workflow-up-to-date', { name: workflow.name }), 'success');
        }
        getCatalogues();
      } else {
        logMessage(t('library.workflow-updated-failure', { name: workflow.name }), 'error');
      }
      return result;
    }).catch((err) => {
      logMessage(t('library.workflow-update-error', { name: workflow.name, error: err.message }), 'error');
    });
  };

  const showCatalogueSectionWorkflows = (catalogue, section) => {
    API.showCatalogueSectionWorkflows(catalogue.name, section.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.workflows-shown-success', { name: section.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.workflows-shown-failure', { name: section.name }), 'error');
      }
    });
  };

  const showSections = (catalogue) => {
    API.showCatalogueSections(catalogue.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.workflows-shown-success', { name: catalogue.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.workflows-shown-failure', { name: catalogue.name }), 'error');
      }
    });
  };

  const runInstallWorkflows = async (workflows) => {
    setProgressValue(0);
    setProgressCount(workflows.length);
    const failed_list = [];
    for (const workflow of workflows) {
      const result = await API.cloneRepo(workflow.repo, workflow.version, workflow.sourceVersion);
      if (!result.ok) {
        failed_list.push(workflow.id);
      } else {
        logMessage(`Cloned ${result.data.name}`, 'success');
      }
      setProgressValue((prev) => prev + 1);
    }
    setProgressCount(0);
    setProgressValue(0);
    if (failed_list.length > 0) {
      const failed_str = failed_list.join(', ');
      logMessage(`${t('library.install-workflows-completed-with-errors')}: ${failed_str}`, 'error');
    }
    setRefresh(!refresh);
    getCatalogues();
  };

  const requestInstallWorkflows = (workflows) => {
    workflows = workflows.filter(
      (workflow, index, self) => index === self.findIndex((w) => w.id === workflow.id)
    );
    setPendingInstallWorkflows(workflows);
  };

  const handleConfirmInstall = () => {
    const workflows = pendingInstallWorkflows;
    setPendingInstallWorkflows(null);
    runInstallWorkflows(workflows);
  };

  const handleCancelInstall = () => {
    setPendingInstallWorkflows(null);
  };

  return (
    <Container>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <EnvironmentStatus navigateToSettingsEnv={navigateToSettingsEnv} />
        </Box>
        <Box sx={{ flex: '0 0 auto' }}>
          <ActionMenu
            setCatalogues={setCatalogues}
            permitAddCatalogues={permitAddCatalogues}
            permitImportShards={permitImportShards}
            permitAddRepos={permitAddRepos}
            logMessage={logMessage}
          />
        </Box>
      </Box>
      <ProgressDialog
        open={progressCount > 0}
        title={t('library.installing-workflows')}
        value={progressValue}
        total={progressCount}
      />
      <ConfirmInstallDialog
        open={pendingInstallWorkflows !== null}
        workflows={pendingInstallWorkflows || []}
        onConfirm={handleConfirmInstall}
        onCancel={handleCancelInstall}
      />
      <Stack spacing={2}>
        {(catalogues || []).map((catalogue) => (
          <CatalogueCard
            catalogue={catalogue}
            deleteCatalogue={() => deleteCatalogue(catalogue)}
            deleteSection={(section) => deleteSection(catalogue, section)}
            hideWorkflow={(section, workflow) => hideWorkflow(catalogue, section, workflow)}
            uninstallWorkflow={(section, workflow) => uninstallWorkflow(catalogue, section, workflow)}
            updateWorkflow={(section, workflow) => updateWorkflow(catalogue, section, workflow)}
            hideSection={(section) => hideSection(catalogue, section)}
            showSections={() => showSections(catalogue)}
            showSectionWorkflows={(section) => showCatalogueSectionWorkflows(catalogue, section)}
            createWorkflowInstance={createWorkflowInstance}
            permitCatalogueModifications={permitCatalogueModifications}
            refresh={refresh}
            requestInstallWorkflows={requestInstallWorkflows}
            logMessage={logMessage}
            getCatalogues={getCatalogues}
            updateMap={updateMap}
          />
        ))}
      </Stack>
      {catalogues === null && (
        <Container>
          <Typography variant="h5" sx={{ mt: 2 }}>
            {t('library.loading-library')}
          </Typography>
        </Container>
      )}
      {Array.isArray(catalogues) && catalogues.length === 0 && (
        <Container>
          <Typography variant="h5" sx={{ mt: 2 }}>
            {t('library.no-repos-installed')}
          </Typography>
        </Container>
      )}
      <Dialog open={uninstallDialogOpen} onClose={() => setUninstallDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('library.uninstall-repository')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('library.confirm-uninstall-workflow', { name: uninstallTarget?.workflow?.name || '' })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUninstallDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmUninstall} variant="contained" color="error">
            {t('library.uninstall-repository')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteDialog !== null} onClose={() => setDeleteDialog(null)} maxWidth="sm" fullWidth>
        {deleteDialog && (
          <>
            <DialogTitle>
              {deleteDialog.type === 'catalogue'
                ? t('library.delete-catalogue-title', { name: deleteDialog.catalogue.name })
                : t('library.delete-section-title', { name: deleteDialog.section.name })}
            </DialogTitle>
            <DialogContent>
              <Typography gutterBottom>{t('library.delete-workflow-prompt')}</Typography>
              <List dense>
                {deleteDialog.workflows.map((wf, i) => (
                  <ListItem key={`${wf.repo}@${wf.version || 'latest'}`} disablePadding>
                    <Switch
                      checked={wf.delete}
                      onChange={() => toggleWorkflow(i)}
                      color="error"
                    />
                    <ListItemText
                      primary={wf.name}
                      secondary={`${wf.repo} @ ${wf.version}`}
                      sx={{ ml: 1 }}
                    />
                  </ListItem>
                ))}
              </List>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button size="small" onClick={() => setAllWorkflows(false)}>
                  {t('library.all-migrate')}
                </Button>
                <Button size="small" onClick={() => setAllWorkflows(true)} color="error">
                  {t('library.all-delete')}
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('library.workflows-summary', {
                  migrateCount: deleteDialog.workflows.filter((w) => !w.delete).length,
                  deleteCount: deleteDialog.workflows.filter((w) => w.delete).length
                })}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialog(null)}>{t('common.cancel')}</Button>
              <Button onClick={confirmDeleteDialog} variant="contained" color="error">
                {deleteDialog.type === 'catalogue'
                  ? t('library.delete-catalogue')
                  : t('library.delete-section')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}
