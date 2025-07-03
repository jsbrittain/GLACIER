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
  Typography
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';

import WorkflowPage from './pages/Workflow';
import SettingsPage from './pages/Settings';

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
  const [view, setView] = useState('workflow');
  const [darkMode, setDarkMode] = useState(false);

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
      const path = await window.electronAPI.getCollectionsPath();
      console.log('Loaded collections path: ', path);
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
    window.electronAPI.setCollectionsPath(value);
  };

  const handleList = async () => {
    const containers = await window.electronAPI.listContainers();
    setOutput(JSON.stringify(containers, null, 2));
  };

  const handleBuildRun = async () => {
    const id = await window.electronAPI.buildAndRunContainer(folderPath, imageName);
    alert('Container built and started with ID: ' + id);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed">
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
            <ListItem button onClick={() => setView('workflow')}>
              <ListItemIcon>
                <PlayArrowIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary="Workflow" />}
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
          {view === 'workflow' ? (
            <WorkflowPage
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
      </Box>
    </ThemeProvider>
  );
}
