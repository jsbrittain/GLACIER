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
  Typography,
  Snackbar,
  Paper,
  Alert
} from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Toolbar from '@mui/material/Toolbar';
import MenuIcon from '@mui/icons-material/Menu';
import LibraryIcon from '@mui/icons-material/Apps';
import InstancesIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';

import LibraryPage from './Library';
import InstancesPage from './Instances';
import SettingsPage from './Settings/Settings';
import TitleBar from './TitleBar';
import { API } from '../services/api.js';

const defaultRepoUrl = 'jsbrittain/workflow-runner-testworkflow';
const defaultImageName = 'testworkflow';

type navbar_page = 'library' | 'instances' | 'settings';
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

export default function MainPage({ darkMode, setDarkMode }) {
  const { t } = useTranslation();

  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl);
  const [collectionsPath, setCollectionsPath] = useState('');
  const [allowArbitraryRepoCloning, setAllowArbitraryRepoCloning] = useState(true);
  const [targetDir, setTargetDir] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [imageName, setImageName] = useState(defaultImageName);
  const [output, setOutput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [view, setView] = useState<navbar_page>('library');
  const [instancesList, setInstancesList] = useState([]);
  const [log, setLog] = useState([]);
  const [severity, setSeverity] = useState<severityLevels>('info');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');

  const refreshInstancesList = async () => {
    API.listWorkflowInstances().then((instances) => {
      setInstancesList(
        instances.map((instance) => ({
          instance: instance,
          name: instance.name
        }))
      );
    });
  };

  useEffect(() => {
    (async () => {
      const path = await API.getCollectionsPath();
      setCollectionsPath(path);
      refreshInstancesList();
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

  const addToInstancesList = async (repo) => {
    const workflow_id = repo.id;
    API.createWorkflowInstance(workflow_id, repo.version).then((instance) => {
      setInstancesList((prev) => {
        const newQueue = [...prev, { instance: instance, name: instance.name }];
        setView('instances');
        setItem(instance.id);
        return newQueue;
      });
    });
  };

  const logMessage = (text, level: severityLevels = 'info') => {
    setLog((prevLog) => [...prevLog, text]);
    setMessage(text);
    setSeverity(level);
    setOpen(true);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <TitleBar
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        view={view}
      />

      <Drawer
        variant="permanent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? 200 : 56,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerOpen ? 200 : 56,
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
          <ListItem button id="sidebar-library-button" onClick={() => setView('library')}>
            <ListItemIcon>
              <LibraryIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.library')} />}
          </ListItem>
          <ListItem
            button
            id="sidebar-instances-button"
            onClick={() => {
              setItem('');
              setView('instances');
            }}
          >
            <ListItemIcon>
              <InstancesIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.instances')} />}
          </ListItem>
          <ListItem button id="sidebar-settings-button" onClick={() => setView('settings')}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('sidebar.settings')} />}
          </ListItem>
        </List>
      </Drawer>

      <PanelGroup direction="vertical" style={{ height: '100vh', width: '100%' }}>
        <Panel defaultSize={96}>
          <Paper
            variant="outlined"
            sx={{ width: '100%', height: '100%', overflowY: 'auto', minHeight: 0, p: 3 }}
            square
          >
            <Toolbar />
            {view === 'library' ? (
              <LibraryPage
                repoUrl={repoUrl}
                setRepoUrl={setRepoUrl}
                targetDir={targetDir}
                setTargetDir={setTargetDir}
                setFolderPath={setFolderPath}
                addToInstancesList={addToInstancesList}
                logMessage={logMessage}
                setView={setView}
              />
            ) : view === 'instances' ? (
              <InstancesPage
                instancesList={instancesList}
                refreshInstancesList={refreshInstancesList}
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
                allowArbitraryRepoCloning={allowArbitraryRepoCloning}
                setAllowArbitraryRepoCloning={setAllowArbitraryRepoCloning}
                logMessage={logMessage}
              />
            ) : null}
          </Paper>
        </Panel>

        <PanelResizeHandle />

        <Panel defaultSize={4}>
          <Paper
            variant="outlined"
            sx={{ width: '100%', height: '100%', overflowY: 'auto' }}
            square
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
        </Panel>
      </PanelGroup>

      <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)}>
        <Alert onClose={() => setOpen(false)} severity={severity} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
