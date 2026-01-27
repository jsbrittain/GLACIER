import React, { useEffect, useState } from 'react';
import {
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Box,
  Grid,
  Select,
  Snackbar,
  MenuItem,
  Alert,
  Link
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { API } from '../services/api.js';

const resolveHttpUrl = (path, source) => {
  if (!path) return null;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }
  if (source) {
    return `${source.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  }
  // Fallback
  return path;
};

function WorkflowCard({ workflow, scheme, addToInstancesList, logMessage }) {
  const { t } = useTranslation();
  const [isRepoInstalled, setIsRepoInstalled] = useState(false);
  workflow['id'] = workflow['repo'];
  workflow['version'] = workflow['version'] ?? 'latest';

  useEffect(() => {
    API.isRepoInstalled(workflow.repo, workflow.version).then((result) => {
      if (result.ok) {
        setIsRepoInstalled(result.data);
      }
    });
  }, []);

  const cloneRepo = async (repoUrl: string, version: string) => {
    const result = await API.cloneRepo(repoUrl, version);
    if (result.ok) {
      logMessage(`Cloned ${result.data.name} to ${result.data.path}`, 'success');
    } else {
      logMessage(t('hub.clone-return-none'), 'error');
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        color: scheme['foreground'] ?? 'inherit',
        background: scheme['background'] ?? 'inherit',
        fontFamily: scheme['font-family'] ?? 'inherit',
      }}
    >
      <Typography variant="h5">{workflow.name}</Typography>
      <Typography variant="subtitle1">
        {workflow.version}
      </Typography>
      <Box sx={{ height: 8 }} />
      <Stack direction="row" spacing={1}>
        {(isRepoInstalled) ? (
          <Button
            id={`collections-run-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['title-foreground'] ?? 'inherit',
              background: scheme['title-background'] ?? 'inherit',
              fontFamily: scheme['font-family'] ?? 'inherit',
            }}
            onClick={() => addToInstancesList(workflow)}
          >
            {t('library.run')}
          </Button>
        ) : (
          <Button
            id={`collections-run-${workflow.name}`}
            size="small"
            variant="contained"
            sx={{
              color: scheme['title-foreground'] ?? 'inherit',
              background: scheme['title-background'] ?? 'inherit',
              fontFamily: scheme['font-family'] ?? 'inherit',
            }}
            onClick={() => cloneRepo(workflow.repo, workflow.version)}
          >
            {t('hub.install')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

function SectionCard({ section, scheme, source, addToInstancesList, logMessage }) {
  return (
    <Paper
      elevation={2}
      sx={{
        color: section?.scheme?.['project-foreground'] ?? scheme['project-foreground'] ?? 'inherit',
        background: section?.scheme?.['project-background'] ?? scheme['project-background'] ?? 'inherit',
        fontFamily: section?.scheme?.['project-font-family'] ?? scheme['project-font-family'] ?? 'inherit',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {(section?.icon) && (
          <Box
            component="img"
            src={resolveHttpUrl(section?.icon, source)}
            sx={{
              ml: 1,
              my: 1,
              borderRadius: 2,
              maxHeight: 60
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <Typography variant="h5" sx={{px: 1, py: 0.2}}>
          {section.name}
        </Typography>
      </Box>
      <Grid container spacing={2} sx={{px: 1, pb: 1}}>
        {(section?.workflows || []).map((workflow) => (
          <Grid size={3}>
            <WorkflowCard
              workflow={workflow}
              scheme={scheme}
              addToInstancesList={addToInstancesList}
              logMessage={logMessage}
            />
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

function CatalogueCard({ catalogue, addToInstancesList, logMessage }) {
  return (
    <Paper
      sx={{
        p: 1,
        background: catalogue?.scheme?.['background'] ?? 'inherit',
        color: catalogue?.scheme?.['foreground'] ?? 'inherit',
        fontFamily: catalogue?.scheme?.['font-family'] ?? 'inherit',
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
          background: catalogue?.scheme?.['title-background'] ?? 'inherit',
          color: catalogue?.scheme?.['title-foreground'] ?? 'inherit',
          fontFamily: catalogue?.scheme?.['title-font-family'] ?? 'inherit',
        }}
      >
        {(catalogue?.icon) && (
          <Box
            component="img"
            src={`${catalogue?.source}/${catalogue.icon}`}
            sx={{
              m: 0.5,
              maxHeight: 80
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <Typography
          variant="h4"
        >
          {catalogue.name}
        </Typography>
      </Box>
      <Stack spacing={1}>
        {(catalogue?.sections || []).map((section) => (
          <SectionCard
            section={section}
            scheme={catalogue?.scheme || {}}
            source={catalogue?.source}
            addToInstancesList={addToInstancesList}
            logMessage={logMessage}
          />
        ))}
      </Stack>
    </Paper>
  );
}

export default function LibraryPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  setTargetDir,
  setFolderPath,
  addToInstancesList,
  logMessage,
  setView
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
    <Container sx={{ pb: 12 }}>
      {' '}
      {/* extra space for fixed log */}
      <Stack spacing={2}>
        {(catalogues || []).map((catalogue) => (
          <CatalogueCard
            catalogue={catalogue}
            addToInstancesList={addToInstancesList}
            logMessage={logMessage}
          />
        ))}
      </Stack>
      {catalogues.length === 0 && (
        <Container>
          <Typography variant="h6" sx={{ mt: 2 }}>
            {t('library.no-repos-installed')}
          </Typography>
        </Container>
      )}
    </Container>
  );
}
