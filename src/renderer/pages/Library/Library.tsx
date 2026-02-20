import React, { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Button,
  Container,
  IconButton,
  Paper,
  Stack,
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

function WorkflowCard({
  workflow,
  deleteWorkflow,
  updateWorkflow,
  scheme,
  createWorkflowInstance,
  refresh,
  setRefresh,
  logMessage
}) {
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState(null);
  const [isRepoInstalled, setIsRepoInstalled] = useState(false);
  const [versionInstalled, setVersionInstalled] = useState('');
  const [loading, setLoading] = useState(false);
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
          setLoading(false);
        }
      } else {
        setIsRepoInstalled(false);
      }
    });

  useEffect(() => {
    checkRepoInstalled();
  }, [refresh]);

  const cloneRepo = async () => {
    setLoading(true);
    const result = await API.cloneRepo(workflow.repo, workflow.version);
    if (result.ok) {
      setLoading(false);
      setRefresh(!refresh);
      logMessage(`Cloned ${result.data.name} to ${result.data.path}`, 'success');
    } else {
      setLoading(false);
      setRefresh(!refresh);
      logMessage(`${t('library.clone-error')} (${result.error.message})`, 'error');
    }
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

  const handleDeleteWorkflow = async () => {
    deleteWorkflow();
    handleMenuClose();
  };

  const checkForUpdates = async () => {
    updateWorkflow();
    handleMenuClose();
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        color: scheme['foreground'] ?? 'text.primary',
        background: scheme['background'] ?? 'background.paper',
        fontFamily: scheme['font-family'] ?? 'inherit'
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
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
          <MenuItem onClick={handleDeleteWorkflow}>{t('library.remove-repository')}</MenuItem>
          {workflow['version'] === 'latest' && isRepoInstalled && (
            <MenuItem onClick={checkForUpdates}>{t('library.check-for-updates')}</MenuItem>
          )}
        </Menu>
      </Box>
      <Typography variant="subtitle1">
        {workflow.version}{' '}
        {isRepoInstalled && workflow.version === 'latest' && `(${versionInstalled})`}
      </Typography>
      <Box sx={{ height: 8 }} />
      <Stack direction="row" spacing={1}>
        {isRepoInstalled ? (
          <Button
            id={`run-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['title-foreground'] ?? undefined,
              background: scheme['title-background'] ?? undefined,
              fontFamily: scheme['font-family'] ?? 'inherit'
            }}
            onClick={runWorkflow}
          >
            {t('library.run')}
          </Button>
        ) : (
          <Button
            id={`install-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['title-foreground'] ?? undefined,
              background: scheme['title-background'] ?? undefined,
              fontFamily: scheme['font-family'] ?? 'inherit'
            }}
            onClick={cloneRepo}
            loading={loading}
          >
            {t('library.install')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

function SectionCard({
  section,
  deleteSection,
  deleteWorkflow,
  updateWorkflow,
  scheme,
  source,
  createWorkflowInstance,
  permitCatalogueModifications,
  refresh,
  setRefresh,
  installAllWorkflows,
  logMessage
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
    await installAllWorkflows(
      workflows.map((workflow) => ({
        id: `${workflow.repo}@${workflow.version}`,
        repo: workflow.repo,
        version: workflow.version
      }))
    );
    setRefresh(!refresh);
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
        color:
          section?.scheme?.['project-foreground'] ?? scheme['project-foreground'] ?? 'text.primary',
        background:
          section?.scheme?.['project-background'] ??
          scheme['project-background'] ??
          'background.paper',
        fontFamily:
          section?.scheme?.['project-font-family'] ?? scheme['project-font-family'] ?? 'inherit'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 1
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
          <Typography variant="h6" sx={{ px: 1, py: 0.2 }}>
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
              <MenuItem onClick={handleDeleteSection}>{t('library.remove-section')}</MenuItem>
            </Menu>
          </>
        )}
      </Box>
      <Grid container spacing={2} sx={{ px: 1, pb: 1 }}>
        {(section?.workflows || []).map((workflow) => (
          <Grid size={3}>
            <WorkflowCard
              workflow={workflow}
              deleteWorkflow={() => deleteWorkflow(workflow)}
              updateWorkflow={() => updateWorkflow(workflow)}
              scheme={scheme}
              createWorkflowInstance={createWorkflowInstance}
              refresh={refresh}
              setRefresh={setRefresh}
              logMessage={logMessage}
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
  deleteWorkflow,
  updateWorkflow,
  createWorkflowInstance,
  permitCatalogueModifications,
  refresh,
  setRefresh,
  installAllWorkflows,
  logMessage
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuIsOpen = Boolean(anchorEl);

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
    await installAllWorkflows(workflows);
    setRefresh(!refresh);
    handleMenuClose();
  };

  const handleDeleteCatalogue = async () => {
    deleteCatalogue();
    handleMenuClose();
  };

  const checkForUpdates = async () => {
    await API.syncRepo(catalogue?.['base_dir']);
    handleMenuClose();
  };

  return (
    <Paper
      sx={{
        p: 1,
        background: catalogue?.scheme?.['background'] ?? 'background.paper',
        color: catalogue?.scheme?.['foreground'] ?? 'text.primary',
        fontFamily: catalogue?.scheme?.['font-family'] ?? 'inherit'
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
          background: catalogue?.scheme?.['title-background'] ?? theme.palette.primary.main,
          color: catalogue?.scheme?.['title-foreground'] ?? theme.palette.primary.contrastText,
          fontFamily: catalogue?.scheme?.['title-font-family'] ?? 'inherit'
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
              {catalogue?.name !== 'User collection' && (
                <MenuItem onClick={checkForUpdates}>{t('library.check-for-updates')}</MenuItem>
              )}
            </Menu>
          </>
        )}
      </Box>
      <Stack spacing={1}>
        {(catalogue?.sections || []).map((section) => (
          <SectionCard
            section={section}
            deleteSection={() => deleteSection(section)}
            deleteWorkflow={(workflow) => deleteWorkflow(section, workflow)}
            updateWorkflow={(workflow) => updateWorkflow(section, workflow)}
            scheme={catalogue?.scheme || {}}
            source={catalogue?.['base_dir']}
            createWorkflowInstance={createWorkflowInstance}
            permitCatalogueModifications={permitCatalogueModifications}
            refresh={refresh}
            setRefresh={setRefresh}
            installAllWorkflows={installAllWorkflows}
            logMessage={logMessage}
          />
        ))}
      </Stack>
    </Paper>
  );
}

export default function LibraryPage({
  createWorkflowInstance,
  permitAddCatalogues,
  permitCatalogueModifications,
  permitAddRepos,
  navigateToSettingsEnv,
  logMessage
}) {
  const { t } = useTranslation();
  const [catalogues, setCatalogues] = useState([]);
  const [refresh, setRefresh] = useState(false);

  const [progressCount, setProgressCount] = useState(0);
  const [progressValue, setProgressValue] = useState(0);

  const getCatalogues = async () => {
    API.getCatalogues().then((result) => {
      if (result.ok) {
        setCatalogues(result.data);
      }
    });
  };

  useEffect(() => {
    getCatalogues();
  }, []);

  const deleteCatalogue = async (catalogue) => {
    if (!window.confirm(t('library.confirm-remove-catalogue', { name: catalogue.name }))) {
      return;
    }
    API.removeCatalogue(catalogue.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.catalogue-removed-success', { name: catalogue.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.catalogue-removed-failure', { name: catalogue.name }), 'error');
      }
    });
  };

  const deleteSection = async (catalogue, section) => {
    if (!window.confirm(t('library.confirm-remove-section', { name: section.name }))) {
      return;
    }
    API.removeCatalogueSection(catalogue.name, section.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.section-removed-success', { name: section.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.section-removed-failure', { name: section.name }), 'error');
      }
    });
  };

  const deleteWorkflow = (catalogue, section, workflow) => {
    if (!window.confirm(t('library.confirm-remove-workflow', { name: workflow.name }))) {
      return;
    }
    API.removeCatalogueWorkflow(catalogue.name, section.name, workflow.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.workflow-removed-success', { name: workflow.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.workflow-removed-failure', { name: workflow.name }), 'error');
      }
    });
  };

  const updateWorkflow = (catalogue, section, workflow) => {
    API.updateCatalogueWorkflow(catalogue.name, section.name, workflow.name).then((result) => {
      if (result.ok) {
        logMessage(t('library.workflow-updated-success', { name: workflow.name }), 'success');
        getCatalogues();
      } else {
        logMessage(t('library.workflow-updated-failure', { name: workflow.name }), 'error');
      }
    });
  };

  const installAllWorkflows = async (workflows) => {
    // Remove duplicates
    workflows = workflows.filter(
      (workflow, index, self) => index === self.findIndex((w) => w.id === workflow.id)
    );
    // Clone
    setProgressValue(0);
    setProgressCount(workflows.length);
    const failed_list = [];
    for (const workflow of workflows) {
      const result = await API.cloneRepo(workflow.repo, workflow.version);
      if (!result.ok) {
        failed_list.push(workflow.id);
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
            permitAddRepos={permitAddRepos}
          />
        </Box>
      </Box>
      <ProgressDialog
        open={progressCount > 0}
        title={t('library.installing-workflows')}
        value={progressValue}
        total={progressCount}
      />
      <Stack spacing={2}>
        {(catalogues || []).map((catalogue) => (
          <CatalogueCard
            catalogue={catalogue}
            deleteCatalogue={() => deleteCatalogue(catalogue)}
            deleteSection={(section) => deleteSection(catalogue, section)}
            deleteWorkflow={(section, workflow) => deleteWorkflow(catalogue, section, workflow)}
            updateWorkflow={(section, workflow) => updateWorkflow(catalogue, section, workflow)}
            createWorkflowInstance={createWorkflowInstance}
            permitCatalogueModifications={permitCatalogueModifications}
            refresh={refresh}
            setRefresh={setRefresh}
            installAllWorkflows={installAllWorkflows}
            logMessage={logMessage}
          />
        ))}
      </Stack>
      {catalogues.length === 0 && (
        <Container>
          <Typography variant="h5" sx={{ mt: 2 }}>
            {t('library.no-repos-installed')}
          </Typography>
        </Container>
      )}
    </Container>
  );
}
