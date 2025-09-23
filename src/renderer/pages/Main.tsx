import React, { useState, useEffect, useMemo } from 'react';
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';
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
import HubIcon from '@mui/icons-material/Hub';
import LibraryIcon from '@mui/icons-material/Apps';
import RunsIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';
import { useTranslation } from 'react-i18next';

import HubPage from './Hub';
import LibraryPage from './Library';
import RunsPage from './Runs';
import SettingsPage from './Settings';
import { API } from '../services/api.js';

const defaultRepoUrl = 'jsbrittain/workflow-runner-testworkflow';
const defaultImageName = 'testworkflow';

type navbar_page = 'hub' | 'library' | 'runs' | 'settings';
type severityLevels = 'info' | 'success' | 'warning' | 'error';

// Quick function to predict target directory based on repo URL and base collections path
// Replace this with a call to the backend
const computeTargetDir = (repoUrl, basePath) => {
  try {
    if (repoUrl.includes('://')) {
      const url = new URL(repoUrl);
      const [owner, repo] = url.pathname
        .replace(/^\//, '')
        .replace(/\.git$/, '')
        .split('/');
      return `${basePath}/workflows/${owner}/${repo}`;
    } else if (repoUrl.includes('/')) {
      const [owner, repo] = repoUrl.replace(/\.git$/, '').split('/');
      return `${basePath}/workflows/${owner}/${repo}`;
    }
  } catch {
    return '';
  }
};

export default function MainPage(darkMode, setDarkMode) {
  const { t } = useTranslation();

  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl);
  const [collectionsPath, setCollectionsPath] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [imageName, setImageName] = useState(defaultImageName);
  const [output, setOutput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<navbar_page>('hub');
  const [launcherQueue, setLauncherQueue] = useState([]);
  const [selectedLauncherTab, setSelectedLauncherTab] = useState(0);
  const [log, setLog] = useState([]);
  const [severity, setSeverity] = useState<severityLevels>('info');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');

  useEffect(() => {
    (async () => {
      const path = await API.getCollectionsPath();
      setCollectionsPath(path);
      const instances = await API.listWorkflowInstances();
      setLauncherQueue(
        instances.map((instance) => ({
          instance: instance,
          name: instance.name
        }))
      );
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
    alert(`${t('container-started')}: ${id}`);
  };

  const generateUniqueName = (baseName, queue) => {
    let newName = '';
    const existingNames = new Set(queue.map((item) => item.name));
    do {
      newName = uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
        length: 2
      });
    } while (existingNames.has(newName));
    return newName;
  };

  const addToLauncherQueue = async (repo) => {
    const workflow_id = repo.id;
    const instance = await API.createWorkflowInstance(workflow_id);
    const wf_ver = instance.workflow_version;

    setLauncherQueue((prev) => {
      const newQueue = [...prev, { instance: instance, name: instance.name }];
      setSelectedLauncherTab(newQueue.length - 1);
      setView('runs');
      return newQueue;
    });
  };

  const logMessage = (text, level: severityLevels = 'info') => {
    setLog((prev) => [...prev.slice(-9), text]);
    setMessage(text);
    setSeverity(level);
    setOpen(true);
  };

  return (
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
            {t('glacier')}
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
          <ListItem button id="sidebar-hub-button" onClick={() => setView('hub')}>
            <ListItemIcon>
              <HubIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.hub')} />}
          </ListItem>
          <ListItem button id="sidebar-library-button" onClick={() => setView('library')}>
            <ListItemIcon>
              <LibraryIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.library')} />}
          </ListItem>
          <ListItem
            button
            id="sidebar-runs-button"
            onClick={() => {
              setItem('');
              setView('runs');
            }}
          >
            <ListItemIcon>
              <RunsIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.runs')} />}
          </ListItem>
          <ListItem button id="sidebar-settings-button" onClick={() => setView('settings')}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.settings')} />}
          </ListItem>
        </List>
      </Drawer>

      {/* Reserve space for the fixed log panel at the bottom */}
      <Box
        component="main"
        sx={(theme) => ({
          flexGrow: 1,
          p: 3,
          mt: 8, // below AppBar
          pb: `calc(120px + ${theme.spacing(2)})` // make room for the 120px log panel + a little spacing
        })}
      >
        {view === 'hub' ? (
          <HubPage
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            targetDir={targetDir}
            setTargetDir={setTargetDir}
            setFolderPath={setFolderPath}
            drawerOpen={drawerOpen}
            logMessage={logMessage}
          />
        ) : view === 'library' ? (
          <LibraryPage
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            targetDir={targetDir}
            setTargetDir={setTargetDir}
            setFolderPath={setFolderPath}
            drawerOpen={drawerOpen}
            addToLauncherQueue={addToLauncherQueue}
            logMessage={logMessage}
          />
        ) : view === 'runs' ? (
          <RunsPage
            launcherQueue={launcherQueue}
            setLauncherQueue={setLauncherQueue}
            selectedTab={selectedLauncherTab}
            setSelectedTab={setSelectedLauncherTab}
            logMessage={logMessage}
            item={item}
            setItem={setItem}
          />
        ) : view === 'settings' ? (
          <SettingsPage
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            collectionsPath={collectionsPath}
            setCollectionsPath={setCollectionsPath}
          />
        ) : null}
      </Box>

      <Paper
        variant="outlined"
        sx={(theme) => ({
          position: 'fixed',
          bottom: 0,
          left: drawerOpen ? 240 : 56,
          right: 0,
          height: 120,
          overflowY: 'auto',
          bgcolor: 'background.default',
          px: 2,
          py: 1,
          borderTop: '1px solid rgba(0,0,0,0.12)',
          transition: theme.transitions.create('left', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
          })
        })}
      >
        <Box
          id="logMessage"
          component="pre"
          sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}
        >
          {log.map((line, index) => (
            <Typography
              key={index}
              variant="body2"
              color={severity === 'error' ? 'error.main' : 'text.primary'}
            >
              {line}
            </Typography>
          ))}
        </Box>
      </Paper>

      <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)}>
        <Alert onClose={() => setOpen(false)} severity={severity} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
