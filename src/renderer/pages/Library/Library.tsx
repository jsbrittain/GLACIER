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
import ActionMenu from './ActionMenu';
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
        }
      }
    });

  useEffect(() => {
    checkRepoInstalled();
  }, [refresh]);

  const cloneRepo = async () => {
    const result = await API.cloneRepo(workflow.repo, workflow.version);
    if (result.ok) {
      setRefresh(!refresh);
      logMessage(`Cloned ${result.data.name} to ${result.data.path}`, 'success');
    } else {
      logMessage(t('library.clone-error'), 'error');
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
    alert('Check for updates not implemented yet.');
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
  scheme,
  source,
  createWorkflowInstance,
  permitCatalogueModifications,
  refresh,
  setRefresh,
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

  const installAllWorkflows = async () => {
    alert('Install all workflows not implemented yet.');
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
              <MenuItem onClick={installAllWorkflows}>
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
  createWorkflowInstance,
  permitCatalogueModifications,
  refresh,
  setRefresh,
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

  const installAllWorkflows = async () => {
    alert('Install all workflows not implemented yet.');
    handleMenuClose();
  };

  const handleDeleteCatalogue = async () => {
    deleteCatalogue();
    handleMenuClose();
  };

  const checkForUpdates = async () => {
    alert('Check for updates not implemented yet.');
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
              <MenuItem onClick={installAllWorkflows}>
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
            scheme={catalogue?.scheme || {}}
            source={catalogue?.['base_dir']}
            createWorkflowInstance={createWorkflowInstance}
            permitCatalogueModifications={permitCatalogueModifications}
            refresh={refresh}
            setRefresh={setRefresh}
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
  logMessage
}) {
  const { t } = useTranslation();
  const [catalogues, setCatalogues] = useState([]);
  const [refresh, setRefresh] = useState(false);

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

  return (
    <Container>
      <ActionMenu
        setCatalogues={setCatalogues}
        permitAddCatalogues={permitAddCatalogues}
        permitAddRepos={permitAddRepos}
      />
      <Stack spacing={2}>
        {(catalogues || []).map((catalogue) => (
          <CatalogueCard
            catalogue={catalogue}
            deleteCatalogue={() => deleteCatalogue(catalogue)}
            deleteSection={(section) => deleteSection(catalogue, section)}
            deleteWorkflow={(section, workflow) => deleteWorkflow(catalogue, section, workflow)}
            createWorkflowInstance={createWorkflowInstance}
            permitCatalogueModifications={permitCatalogueModifications}
            refresh={refresh}
            setRefresh={setRefresh}
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
