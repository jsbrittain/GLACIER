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
  Snackbar,
  Alert
} from '@mui/material';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';

export default function HubPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  drawerOpen,
  setTargetDir,
  setFolderPath,
  logMessage
}) {
  const { t } = useTranslation();

  const [installedRepos, setInstalledRepos] = useState([]);
  const [open, setOpen] = useState(false);

  const repos = [
    {
      name: 'Minimal Docker Workflow',
      url: 'jsbrittain/workflow-runner-testworkflow'
    },
    {
      name: 'Minimal Nextflow Workflow',
      url: 'jsbrittain/workflow-runner-test-nextflow'
    },
    {
      name: 'Artic Network MPXV Analysis',
      url: 'artic-network/artic-mpxv-nf'
    }
  ];

  const updateInstalledRepos = async () => {
    const list = await API.getCollections();
    setInstalledRepos(list);
  };

  useEffect(() => {
    updateInstalledRepos();
  }, []);

  const cloneRepo = async (repoUrl) => {
    try {
      const result = await API.cloneRepo(repoUrl);
      if (result?.path) {
        setTargetDir(result.path);
        setFolderPath(result.path);
        logMessage(`Cloned ${result.name} to ${result.path}`, 'success');
      } else {
        logMessage(t('hub.clone-return-none'), 'error');
      }
    } catch (err) {
      console.error(err);
      logMessage(t('hub.clone-failed'), 'error');
    }
    updateInstalledRepos();
  };

  const isRepoInstalled = (repoUrl) => {
    return installedRepos.some((repo) => repo.url === repoUrl);
  };

  return (
    <Container sx={{ pb: 12 }}>
      {' '}
      {/* extra space for fixed log */}
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t('hub.clone-a-github-repository')}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>{t('hub.repo')}:</Typography>
            <TextField
              id="collections-repo-url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              size="small"
              fullWidth
            />
            <Button
              id="collections-clone-button"
              variant="contained"
              onClick={() => cloneRepo(repoUrl)}
              size="small"
            >
              {t('hub.clone')}
            </Button>
          </Stack>
          {targetDir && (
            <Typography variant="body2" sx={{ mt: 1, color: 'gray' }}>
              {targetDir}
            </Typography>
          )}
        </Paper>

        <Grid container spacing={2}>
          {repos.map((repo) => (
            /* @ts-ignore */
            <Grid item xs={12} sm={6} md={4} key={repo.url}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {repo.name}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    id={`hub-install-${repo.name}`}
                    size="small"
                    variant="contained"
                    onClick={() => cloneRepo(repo.url)}
                    disabled={isRepoInstalled(repo.url)}
                  >
                    {t('hub.install')}
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
