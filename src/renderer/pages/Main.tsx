import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Typography,
  Snackbar,
  Paper,
  Alert
} from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import LibraryIcon from '@mui/icons-material/Apps';
import InstancesIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import { useTranslation } from 'react-i18next';

import LibraryPage from './Library/Library';
import InstancesPage from './Instances';
import SettingsPage from './Settings/Settings';
import { SettingsKey } from '../../types/settings.js';
import { API } from '../services/api.js';

type navbar_page = 'library' | 'instances' | 'settings';
type severityLevels = 'info' | 'success' | 'warning' | 'error';

export default function MainPage({ darkMode, setDarkMode }) {
  const { t } = useTranslation();

  const [collectionsPath, setCollectionsPath] = useState('');
  const [permitAddCatalogues, setPermitAddCatalogues] = useState(true);
  const [permitCatalogueModifications, setPermitCatalogueModifications] = useState(true);
  const [permitAddRepos, setPermitAddRepos] = useState(true);
  const [drawerOpen] = useState(true);
  const [view, setView] = useState<navbar_page>('library');
  const [instancesList, setInstancesList] = useState([]);
  const [log, setLog] = useState([]);
  const [severity, setSeverity] = useState<severityLevels>('info');
  const [message, setMessage] = useState('');
  const [showHiddenParams, setShowHiddenParams] = useState(false);
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');
  const [navigateToSettingsPage, setNavigateToSettingsPage] = useState('');

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
      API.settingsGet(SettingsKey.PermitAddCatalogues).then((result) => {
        setPermitAddCatalogues(result);
      });
      API.settingsGet(SettingsKey.PermitCatalogueModifications).then((result) => {
        setPermitCatalogueModifications(result);
      });
      API.settingsGet(SettingsKey.PermitAddRepos).then((result) => {
        setPermitAddRepos(result);
      });
      const r = await API.init();
      if (!r.ok) {
        alert(t('error.parsing-catalogue') + ': ' + r.error.message);
      }
      const path = await API.getCollectionsPath();
      setCollectionsPath(path);
      refreshInstancesList();
    })();
  }, []);

  const createWorkflowInstance = async (repo) => {
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

  const navigateToSettingsEnv = () => {
    setView('settings');
    setNavigateToSettingsPage('environment');
  };

  const logMessage = (text, level: severityLevels = 'info') => {
    setLog((prevLog) => [...prevLog, text]);
    setMessage(text);
    setSeverity(level);
    setOpen(true);
  };

  return (
    <Box sx={{ display: 'flex' }}>
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
        <List
          sx={(theme) => ({
            '& .MuiListItemButton-root.Mui-selected': {
              boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
              '& .MuiListItemIcon-root': {
                color: theme.palette.primary.main
              },
              '&:hover': {
                backgroundColor: theme.palette.action.selected
              }
            }
          })}
        >
          <ListItem disablePadding>
            <ListItemButton
              id="sidebar-library-button"
              selected={view === 'library'}
              onClick={() => setView('library')}
            >
              <ListItemIcon>
                <LibraryIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('sidebar.library')} />}
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              id="sidebar-instances-button"
              selected={view === 'instances'}
              onClick={() => {
                setItem('');
                setView('instances');
              }}
            >
              <ListItemIcon>
                <InstancesIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('sidebar.instances')} />}
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              id="sidebar-settings-button"
              selected={view === 'settings'}
              onClick={() => setView('settings')}
            >
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('sidebar.settings')} />}
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      <PanelGroup direction="vertical" style={{ height: '100vh', width: '100%' }}>
        <Panel>
          <Paper
            variant="outlined"
            sx={{ width: '100%', height: '100%', overflowY: 'auto', minHeight: 0, p: 3 }}
            square
          >
            {view === 'library' ? (
              <LibraryPage
                createWorkflowInstance={createWorkflowInstance}
                permitAddCatalogues={permitAddCatalogues}
                permitCatalogueModifications={permitCatalogueModifications}
                permitAddRepos={permitAddRepos}
                navigateToSettingsEnv={navigateToSettingsEnv}
                logMessage={logMessage}
              />
            ) : view === 'instances' ? (
              <InstancesPage
                instancesList={instancesList}
                refreshInstancesList={refreshInstancesList}
                logMessage={logMessage}
                item={item}
                setItem={setItem}
                showHiddenParams={showHiddenParams}
              />
            ) : view === 'settings' ? (
              <SettingsPage
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                collectionsPath={collectionsPath}
                setCollectionsPath={setCollectionsPath}
                permitAddCatalogues={permitAddCatalogues}
                setPermitAddCatalogues={setPermitAddCatalogues}
                permitCatalogueModifications={permitCatalogueModifications}
                setPermitCatalogueModifications={setPermitCatalogueModifications}
                permitAddRepos={permitAddRepos}
                setPermitAddRepos={setPermitAddRepos}
                showHiddenParams={showHiddenParams}
                setShowHiddenParams={setShowHiddenParams}
                navigateToPage={navigateToSettingsPage}
                setNavigateToPage={setNavigateToSettingsPage}
              />
            ) : null}
          </Paper>
        </Panel>

        <PanelResizeHandle />

        <Panel defaultSize={4} minSize={3} collapsible>
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
