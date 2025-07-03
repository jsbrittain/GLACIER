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

export default function WorkflowPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  drawerOpen,
  setTargetDir,
  setFolderPath
}) {
  const [repos, setRepos] = useState([]);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);

  const logMessage = (text, level = 'info') => {
    setLog((prev) => [...prev.slice(-9), text]);
    setMessage(text);
    setSeverity(level);
    setOpen(true);
  };

  useEffect(() => {
    (async () => {
      const list = await API.getCollections();
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
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              size="small"
              fullWidth
            />
            <Button variant="contained" onClick={handleClone} size="small">
              Clone
            </Button>
          </Stack>
          {targetDir && (
            <Typography variant="body2" sx={{ mt: 1, color: 'gray' }}>
              Cloning to: {targetDir}
            </Typography>
          )}
        </Paper>

        <Typography variant="h6">Local Repositories</Typography>
        <Grid container spacing={2}>
          {repos.map((repo) => (
            <Grid item xs={12} sm={6} md={4} key={repo.path}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {repo.name}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={async () => {
                      try {
                        const id = await API.runRepo(repo);
                        logMessage(`Container started: ${id}`, 'success');
                      } catch (err) {
                        console.error(err);
                        logMessage('Run failed', 'error');
                      }
                    }}
                  >
                    Run
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      try {
                        const result = await API.syncRepo(repo);
                        if (result?.status === 'ok') {
                          logMessage('Repo synced', 'success');
                        } else {
                          throw new Error(result?.message || 'Unknown sync failure');
                        }
                      } catch (err) {
                        console.error(err);
                        logMessage('Sync failed', 'error');
                      }
                    }}
                  >
                    Sync
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
      <Paper
        variant="outlined"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: drawerOpen ? 240 : 56,
          right: 0,
          height: 120,
          overflowY: 'auto',
          bgcolor: 'background.default',
          px: 2,
          py: 1,
          borderTop: '1px solid rgba(0,0,0,0.12)'
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Log
        </Typography>
        <Box component="pre" sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
          {log.join('\n')}
        </Box>
      </Paper>
      <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)}>
        <Alert onClose={() => setOpen(false)} severity={severity} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
