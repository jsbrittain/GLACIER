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

export default function HubPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  drawerOpen,
  setTargetDir,
  setFolderPath,
  addToLauncherQueue,
  logMessage
}) {
  const [repos, setRepos] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await API.getCollections();
      console.log('Fetched collections:', list);
      setRepos(list);
    })();
  }, []);

  const handleClone = async () => {
    try {
      const result = await API.cloneRepo(repoUrl);
      if (result?.path) {
        setTargetDir(result.path);
        setFolderPath(result.path);
        logMessage(`Cloned ${result.name} to ${result.path}`, 'success');
        const list = await API.getCollections();
        setRepos(list);
      } else {
        logMessage('Clone failed or returned nothing', 'error');
      }
    } catch (err) {
      console.error(err);
      logMessage('Clone operation failed', 'error');
    }
  };

  return (
    <Container sx={{ pb: 12 }}>
      {' '}
      {/* extra space for fixed log */}
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Clone a GitHub Repository
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>Repo:</Typography>
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
              onClick={handleClone}
              size="small"
            >
              Clone
            </Button>
          </Stack>
          {targetDir && (
            <Typography variant="body2" sx={{ mt: 1, color: 'gray' }}>
              {targetDir}
            </Typography>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
