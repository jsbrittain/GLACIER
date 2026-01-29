import React, { useEffect, useState } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Button,
  Container,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  Box,
  Grid,
  Select,
  Snackbar,
  Menu,
  MenuItem,
  Alert,
  Link
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import QueryAddCatalogueDialog from './QueryAddCatalogueDialog';
import QueryAddWorkflowDialog from './QueryAddWorkflowDialog';
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

function WorkflowCard({ workflow, scheme, createWorkflowInstance, logMessage }) {
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState(null);
  const [isRepoInstalled, setIsRepoInstalled] = useState(false);
  const [versionInstalled, setVersionInstalled] = useState('');
  const menuIsOpen = Boolean(anchorEl);

  workflow['id'] = workflow['repo'];
  workflow['version'] = workflow['version'] ?? 'latest';

  useEffect(() => {
    API.isRepoInstalled(workflow.repo, workflow.version).then((result) => {
      if (result.ok) {
        const installed_version = result.data;
        if (installed_version) {
          setVersionInstalled(installed_version);
          setIsRepoInstalled(true);
        }
      }
    });
  }, []);

  const cloneRepo = async (repoUrl: string, version: string) => {
    const result = await API.cloneRepo(repoUrl, version);
    if (result.ok) {
      logMessage(`Cloned ${result.data.name} to ${result.data.path}`, 'success');
    } else {
      logMessage(t('library.clone-error'), 'error');
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const removeWorkflow = (workflow) => async () => {
    alert('Remove workflow not implemented yet.');
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
          <MenuItem onClick={removeWorkflow(workflow)}>{t('library.remove-repository')}</MenuItem>
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
            id={`collections-run-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['title-foreground'] ?? undefined,
              background: scheme['title-background'] ?? undefined,
              fontFamily: scheme['font-family'] ?? 'inherit'
            }}
            onClick={() => createWorkflowInstance(workflow)}
          >
            {t('library.run')}
          </Button>
        ) : (
          <Button
            id={`collections-run-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['title-foreground'] ?? undefined,
              background: scheme['title-background'] ?? undefined,
              fontFamily: scheme['font-family'] ?? 'inherit'
            }}
            onClick={() => cloneRepo(workflow.repo, workflow.version)}
          >
            {t('library.install')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

function SectionCard({ section, scheme, source, createWorkflowInstance, logMessage }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuIsOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const removeCatalogueSection = (section) => async () => {
    alert('Remove section not implemented yet.');
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
        <Box sx={{ ml: 'auto' }}>
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
          <MenuItem onClick={removeCatalogueSection(section)}>
            {t('library.remove-section')}
          </MenuItem>
        </Menu>
      </Box>
      <Grid container spacing={2} sx={{ px: 1, pb: 1 }}>
        {(section?.workflows || []).map((workflow) => (
          <Grid size={3}>
            <WorkflowCard
              workflow={workflow}
              scheme={scheme}
              createWorkflowInstance={createWorkflowInstance}
              logMessage={logMessage}
            />
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

function CatalogueCard({ catalogue, createWorkflowInstance, logMessage }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuIsOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const removeCatalogue = (catalogue) => async () => {
    alert('Remove catalogue not implemented yet.');
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
        <Box sx={{ ml: 'auto' }}>
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
          <MenuItem onClick={removeCatalogue(catalogue)}>{t('library.remove-catalogue')}</MenuItem>
        </Menu>
      </Box>
      <Stack spacing={1}>
        {(catalogue?.sections || []).map((section) => (
          <SectionCard
            section={section}
            scheme={catalogue?.scheme || {}}
            source={catalogue?.['base_dir']}
            createWorkflowInstance={createWorkflowInstance}
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
  permitAddRepos,
  logMessage
}) {
  const { t } = useTranslation();
  const [catalogues, setCatalogues] = useState([]);

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
            createWorkflowInstance={createWorkflowInstance}
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
