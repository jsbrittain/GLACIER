import React, { useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Typography,
  Snackbar,
  Paper,
  Alert
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CollectionsIcon from '@mui/icons-material/Hub';
import LauncherIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';

import CollectionsPage from './pages/Collections';
import SettingsPage from './pages/Settings';
import LauncherPage from './pages/Launcher';
import { API } from './services/api.js';

const defaultRepoUrl = 'jsbrittain/workflow-runner-testworkflow';
const defaultImageName = 'testworkflow';

function computeTargetDir(repoUrl, basePath) {
  try {
    if (repoUrl.includes('://')) {
      const url = new URL(repoUrl);
      const [owner, repo] = url.pathname
        .replace(/^\//, '')
        .replace(/\.git$/, '')
        .split('/');
      return `${basePath}/${owner}/${repo}`;
    } else if (repoUrl.includes('/')) {
      const [owner, repo] = repoUrl.replace(/\.git$/, '').split('/');
      return `${basePath}/${owner}/${repo}`;
    }
  } catch {
    return '';
  }
}

export default function App() {
  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl);
  const [collectionsPath, setCollectionsPath] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [imageName, setImageName] = useState(defaultImageName);
  const [output, setOutput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState('collections');
  const [darkMode, setDarkMode] = useState(false);
  const [launcherQueue, setLauncherQueue] = useState([]);
  const [selectedLauncherTab, setSelectedLauncherTab] = useState(0);
  const [log, setLog] = useState([]);
  const [severity, setSeverity] = useState('info');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light'
        }
      }),
    [darkMode]
  );

  useEffect(() => {
    (async () => {
      const path = await API.getCollectionsPath();
      setCollectionsPath(path);
    })();
  }, []);

  useEffect(() => {
    const predictedPath = computeTargetDir(repoUrl, collectionsPath);
    setTargetDir(predictedPath);
  }, [repoUrl, collectionsPath]);

  const handlePathChange = (e) => {
    const value = e.target.value;
    setCollectionsPath(value);
    API.setCollectionsPath(value);
  };

  const handleList = async () => {
    const containers = await API.listContainers();
    setOutput(JSON.stringify(containers, null, 2));
  };

  const handleBuildRun = async () => {
    const id = await API.buildAndRunContainer(folderPath, imageName);
    alert('Container built and started with ID: ' + id);
  };

  const handleLaunch = async (repo, params) => {
    const id = await API.runRepo(repo);
    logMessage(`Container started with ID: ${id}`, 'success');
  };

  function generateUniqueName(baseName, queue) {
    let newName = baseName;
    let counter = 1;
    const existingNames = new Set(queue.map((item) => item.name));

    while (existingNames.has(newName)) {
      newName = `${baseName}-${counter}`;
      counter += 1;
    }
    return newName;
  }

  const addToLauncherQueue = async (repo) => {
    try {
      const params = await API.getWorkflowParams(repo.path);
      setLauncherQueue((prev) => {
        const newQueue = [...prev, { repo, params, name: generateUniqueName(repo.name, prev) }];
        setSelectedLauncherTab(newQueue.length - 1);
        setView('launcher');
        return newQueue;
      });
    } catch (err) {
      console.error('Failed to load workflow params:', err);
      setLauncherQueue((prev) => {
        const newQueue = [...prev, { repo, params: {}, name: generateUniqueName(repo.name, prev) }];
        setSelectedLauncherTab(newQueue.length - 1);
        setView('launcher');
        return newQueue;
      });
    }
  };

  const logMessage = (text, level = 'info') => {
    setLog((prev) => [...prev.slice(-9), text]);
    setMessage(text);
    setSeverity(level);
    setOpen(true);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            width: `calc(100% - ${drawerOpen ? 240 : 56}px)`,
            ml: drawerOpen ? '240px' : '56px',
            transition: (theme) =>
              theme.transitions.create(['width', 'margin-left'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen
              })
          }}
        >
          <Toolbar>
            <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen((prev) => !prev)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ ml: 1 }}>
              Workflow Runner
            </Typography>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="permanent"
          open={drawerOpen}
          sx={{
            width: drawerOpen ? 240 : 56,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerOpen ? 240 : 56,
              overflowX: 'hidden',
              transition: (theme) =>
                theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen
                })
            }
          }}
        >
          <List>
            <ListItem button onClick={() => setView('collections')}>
              <ListItemIcon>
                <CollectionsIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary="Collections" />}
            </ListItem>
            <ListItem button onClick={() => setView('launcher')}>
              <ListItemIcon>
                <LauncherIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary="Launcher" />}
            </ListItem>
            <ListItem button onClick={() => setView('settings')}>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary="Settings" />}
            </ListItem>
          </List>
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
          {view === 'collections' ? (
            <CollectionsPage
              repoUrl={repoUrl}
              setRepoUrl={setRepoUrl}
              targetDir={targetDir}
              setTargetDir={setTargetDir}
              folderPath={folderPath}
              setFolderPath={setFolderPath}
              imageName={imageName}
              setImageName={setImageName}
              output={output}
              setOutput={setOutput}
              onBuildRun={handleBuildRun}
              onList={handleList}
              drawerOpen={drawerOpen}
              addToLauncherQueue={addToLauncherQueue}
              logMessage={logMessage}
            />
          ) : view === 'launcher' ? (
            <LauncherPage
              launcherQueue={launcherQueue}
              setLauncherQueue={setLauncherQueue}
              selectedTab={selectedLauncherTab}
              setSelectedTab={setSelectedLauncherTab}
              onLaunch={handleLaunch}
              logMessage={logMessage}
            />
          ) : (
            <SettingsPage
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              collectionsPath={collectionsPath}
              setCollectionsPath={setCollectionsPath}
            />
          )}
        </Box>
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
          <Box component="pre" sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {log.join('\n')}
          </Box>
        </Paper>
        <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)}>
          <Alert onClose={() => setOpen(false)} severity={severity} sx={{ width: '100%' }}>
            {message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
