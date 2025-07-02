import React, { useState, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
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
import { CssBaseline } from '@mui/material';
import WorkflowPage from './pages/Workflow';
import SettingsPage from './pages/Settings';

const defaultRepoUrl = 'https://github.com/jsbrittain/workflow-runner-testworkflow.git';
const defaultImageName = 'testworkflow';

export default function App() {
  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl);
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

  const handleClone = async () => {
    const result = await window.electronAPI.cloneRepo(repoUrl, targetDir);
    setFolderPath(targetDir);
    alert(result);
  };

  const handleList = async () => {
    const containers = await window.electronAPI.listContainers();
    setOutput(JSON.stringify(containers, null, 2));
  };

  const handleClear = async () => {
    const removed = await window.electronAPI.clearStoppedContainers();
    alert('Removed containers:\n' + removed.join('\n'));
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
            <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div">
              Workflow Runner
            </Typography>
          </Toolbar>
        </AppBar>

        <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box sx={{ width: 240 }} role="presentation">
            <List>
              <ListItem
                button
                onClick={() => {
                  setView('workflow');
                  setDrawerOpen(false);
                }}
              >
                <ListItemText primary="Clone & Run" />
              </ListItem>
              <ListItem
                button
                onClick={() => {
                  setView('settings');
                  setDrawerOpen(false);
                }}
              >
                <ListItemText primary="Settings" />
              </ListItem>
            </List>
          </Box>
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
              onClone={handleClone}
              onBuildRun={handleBuildRun}
              onList={handleList}
              onClear={handleClear}
            />
          ) : (
            <SettingsPage darkMode={darkMode} setDarkMode={setDarkMode} />
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
